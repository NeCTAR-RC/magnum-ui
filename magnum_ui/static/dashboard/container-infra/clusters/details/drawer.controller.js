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
   * @ngdoc controller
   * @name horizon.dashboard.container-infra.clusters.DrawerController
   * @description
   * This is the controller for the cluster drawer (summary) view.
   * The cluster's availability zone and network driver are not stored on the
   * cluster itself, so they are derived from its cluster template: the
   * availability zone is encoded in the template name, while the network driver
   * is a field on the template.
   */
  angular
    .module('horizon.dashboard.container-infra.clusters')
    .controller('horizon.dashboard.container-infra.clusters.DrawerController', controller);

  controller.$inject = [
    '$scope',
    'horizon.app.core.openstack-service-api.magnum',
    'horizon.dashboard.container-infra.utils.service'
  ];

  function controller($scope, magnum, utils) {
    var ctrl = this;
    ctrl.availabilityZone = '';
    ctrl.networkDriver = '';

    if ($scope.item && $scope.item.cluster_template_id) {
      magnum.getClusterTemplate($scope.item.cluster_template_id).then(onGetClusterTemplate);
    }

    function onGetClusterTemplate(response) {
      if (!response) { return; }
      var template = response.data;
      ctrl.networkDriver = template.network_driver;
      // The availability zone is only available by parsing the template name.
      var parsed = utils.parseTemplateName(template.name);
      if (parsed) {
        ctrl.availabilityZone = parsed.availabilityZone;
        if (!ctrl.networkDriver) {
          ctrl.networkDriver = parsed.networkDriver;
        }
      }
    }
  }
})();
