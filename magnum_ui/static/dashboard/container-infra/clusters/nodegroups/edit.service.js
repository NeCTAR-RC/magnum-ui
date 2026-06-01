/**
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
   * @name horizon.dashboard.container-infra.clusters.nodegroups.edit.service
   * @description Service for the "Edit Autoscaling" modal on the cluster
   * detail page. Updates a nodegroup's min/max node count.
   */
  angular
    .module('horizon.dashboard.container-infra.clusters')
    .factory('horizon.dashboard.container-infra.clusters.nodegroups.edit.service',
      editService);

  editService.$inject = [
    'horizon.app.core.openstack-service-api.magnum',
    'horizon.framework.util.i18n.gettext',
    'horizon.framework.widgets.form.ModalFormService',
    'horizon.framework.widgets.toast.service'
  ];

  function editService(magnum, gettext, modal, toast) {
    return {
      perform: perform
    };

    function perform(clusterId, nodegroup) {
      var model = {
        min_node_count: nodegroup.min_node_count,
        max_node_count: nodegroup.max_node_count
      };
      var config = {
        title: interpolate(
          gettext('Edit Autoscaling: %(name)s'), {name: nodegroup.name}, true),
        schema: {
          type: 'object',
          properties: {
            'min_node_count': { type: 'number', minimum: 0 },
            'max_node_count': { type: 'number', minimum: 1 }
          }
        },
        form: [
          { key: 'min_node_count', title: gettext('Minimum Node Count'), required: true },
          {
            key: 'max_node_count',
            title: gettext('Maximum Node Count'),
            required: true,
            validationMessage: {
              maxLtMin: gettext('Maximum must be greater than or equal to minimum.')
            },
            $validators: {
              maxLtMin: function(value) {
                return value >= model.min_node_count;
              }
            }
          }
        ],
        model: model
      };

      return modal.open(config).then(function() {
        return magnum.updateNodegroup(clusterId, nodegroup.id, {
          min_node_count: model.min_node_count,
          max_node_count: model.max_node_count
        }).then(function() {
          toast.add('success', gettext('Node group is being updated.'));
        });
      });
    }
  }
})();
