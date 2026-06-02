/**
 * Copyright 2017 NEC Corporation
 *
 * Licensed under the Apache License, Version 2.0 (the "License"); you may
 * not use this file except in compliance with the License. You may obtain
 * a copy of the License at
 *
 *    http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS, WITHOUT
 * WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the
 * License for the specific language governing permissions and limitations
 * under the License.
 */

(function() {
  'use strict';

  /**
   * @ngdoc overview
   * @name horizon.dashboard.container-infra.clusters.rolling-upgrade.service
   * @description Service for the container-infra cluster rolling upgrade modal.
   * The cluster templates a cluster can be upgraded to are listed by id in the
   * `upgrade_targets` label of its current cluster template; the user picks the
   * target by Kubernetes version.
   */
  angular
    .module('horizon.dashboard.container-infra.clusters')
    .factory('horizon.dashboard.container-infra.clusters.rolling-upgrade.service', upgradeService);

  upgradeService.$inject = [
    '$q',
    '$document',
    'horizon.app.core.openstack-service-api.magnum',
    'horizon.framework.util.actions.action-result.service',
    'horizon.framework.util.i18n.gettext',
    'horizon.framework.util.q.extensions',
    'horizon.framework.widgets.form.ModalFormService',
    'horizon.framework.widgets.toast.service',
    'horizon.framework.widgets.modal-wait-spinner.service',
    'horizon.dashboard.container-infra.clusters.resourceType',
    'horizon.dashboard.container-infra.utils.service'
  ];

  function upgradeService(
    $q, $document, magnum, actionResult, gettext, $qExtensions, modal, toast, spinnerModal,
    resourceType, utils
  ) {

    var modalConfig, formModel, isLatestTemplate, versionTitleMap;

    var service = {
      perform: perform,
      allowed: allowed
    };

    return service;

    //////////////

    function perform(selected, $scope) {
      // Simulate a click to dismiss opened action dropdown, otherwise it could interfere with
      // correct behaviour of other dropdowns.
      $document[0].body.click();

      var deferred = $q.defer();
      spinnerModal.showModalSpinner(gettext('Loading'));

      var currentTemplateId;

      magnum.getCluster(selected.id).then(function(response) {
        var cluster = response.data;

        formModel = getFormModelDefaults();
        formModel.id = selected.id;

        currentTemplateId = cluster.cluster_template_id;

        return magnum.getClusterTemplates();
      }).then(function(response) {
        buildVersionTitleMap(response.data.items);

        modalConfig = createModalConfig();

        deferred.resolve(modal.open(modalConfig).then(onModalSubmit));
        spinnerModal.hideModalSpinner();

        $scope.model = formModel;
      }).catch(onError);

      function buildVersionTitleMap(templates) {
        versionTitleMap = [
          // Default <select> placeholder
          {
            value: '',
            name: gettext('Choose a Kubernetes version to upgrade to')
          }
        ];

        if (!templates) {
          isLatestTemplate = true;
          return;
        }

        // Index the templates by id so upgrade target ids can be resolved to
        // their Kubernetes versions.
        var templatesById = {};
        templates.forEach(function(template) {
          templatesById[template.id] = template;
        });

        // The cluster's current cluster template lists the templates it can be
        // upgraded to in its `upgrade_targets` label. An empty/missing label
        // means there are no targets.
        var current = templatesById[currentTemplateId];
        var targetIds = parseUpgradeTargets(
          current && current.labels ? current.labels.upgrade_targets : null);

        targetIds.forEach(function(targetId) {
          var target = templatesById[targetId];
          // The Kubernetes version is encoded in the template name, not a label.
          var parsed = target ? utils.parseTemplateName(target.name) : null;
          if (parsed) {
            versionTitleMap.push({
              // Submit the template id, but show the user the Kubernetes version.
              value: target.id,
              name: parsed.k8sVersion
            });
          }
        });

        // Order versions in descending order, keeping the placeholder first.
        versionTitleMap.sort(function(first, second) {
          if (first.value === '') { return -1; }
          if (second.value === '') { return 1; }
          return utils.versionCompare(second.name, first.name);
        });

        // No upgrade targets means the cluster is already on the latest template.
        isLatestTemplate = versionTitleMap.length === 1;
      }

      function onError(err) {
        spinnerModal.hideModalSpinner();
        deferred.promise.catch(angular.noop);
        return deferred.reject(err);
      }

      return deferred.promise;
    }

    function createModalConfig() {
      return {
        title: gettext('Rolling Cluster Upgrade'),
        schema: {
          type: 'object',
          properties: {
            'cluster_template_id': {
              title: gettext('Kubernetes Version'),
              type: 'string'
            }
          }
        },
        form: [
          {
            key: 'cluster_template_id',
            type: 'select',
            titleMap: versionTitleMap,
            required: true,
            readonly: isLatestTemplate,
            description: isLatestTemplate
              ? gettext('<em>This cluster is already on the latest Kubernetes version</em>') : null
          }
        ],
        model: formModel
      };
    }

    function getFormModelDefaults() {
      return {
        cluster_template_id: ''
      };
    }

    function allowed() {
      return $qExtensions.booleanAsPromise(true);
    }

    function onModalSubmit() {
      return magnum.upgradeCluster(formModel.id, {
        cluster_template: formModel.cluster_template_id,
        // The driver ignores the batch size, so always upgrade one node at a time.
        max_batch_size: 1,
        nodegroup: 'default-worker'
      }).then(onRequestSuccess);
    }

    function onRequestSuccess() {
      toast.add('success', gettext('Cluster is being upgraded to the new Kubernetes version'));
      return actionResult.getActionResult()
        .updated(resourceType, formModel.id)
        .result;
    }

    // The `upgrade_targets` label holds a comma-separated list of cluster
    // template ids. Returns an array of ids, or an empty array when unset.
    function parseUpgradeTargets(value) {
      if (!value) { return []; }
      if (angular.isArray(value)) { return value; }
      return value.split(',').map(function(id) {
        return id.trim();
      }).filter(Boolean);
    }

  }
})();
