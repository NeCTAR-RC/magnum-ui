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
   * @name horizon.dashboard.container-infra.clusters.nodegroups.resize.service
   * @description Service for the "Resize Node Group" modal on the cluster
   * detail page. Reuses the cluster resize API targeting a single nodegroup.
   */
  angular
    .module('horizon.dashboard.container-infra.clusters')
    .factory('horizon.dashboard.container-infra.clusters.nodegroups.resize.service',
      resizeService);

  resizeService.$inject = [
    'horizon.app.core.openstack-service-api.magnum',
    'horizon.framework.util.i18n.gettext',
    'horizon.framework.widgets.form.ModalFormService',
    'horizon.framework.widgets.toast.service'
  ];

  function resizeService(magnum, gettext, modal, toast) {
    return {
      perform: perform
    };

    function perform(clusterId, nodegroup) {
      var model = { node_count: nodegroup.node_count };
      var config = {
        title: interpolate(
          gettext('Resize Node Group: %(name)s'), {name: nodegroup.name}, true),
        schema: {
          type: 'object',
          properties: {
            'node_count': { type: 'number', minimum: 0 }
          }
        },
        form: [
          { key: 'node_count', title: gettext('Node Count'), required: true }
        ],
        model: model
      };

      return modal.open(config).then(function() {
        return magnum.resizeCluster(clusterId, {
          node_count: model.node_count,
          nodegroup: nodegroup.name
        }).then(function() {
          toast.add('success', gettext('Node group is being resized.'));
        });
      });
    }
  }
})();
