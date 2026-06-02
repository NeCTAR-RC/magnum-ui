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
   * @name NodeGroupOverviewController
   * @description
   * Controller for the node group detail (Overview) page. Exposes the full
   * node group resolved by the detail view's load function.
   */
  angular
    .module('horizon.dashboard.container-infra.clusters')
    .controller('NodeGroupOverviewController', NodeGroupOverviewController);

  NodeGroupOverviewController.$inject = ['$scope'];

  function NodeGroupOverviewController($scope) {
    var ctrl = this;
    ctrl.nodegroup = {};
    // Show a spinner until the node group resolves, rather than a page full of
    // empty fields and misleading "No labels."/"No node addresses." messages.
    ctrl.loading = true;
    ctrl.objLen = objLen;

    $scope.context.loadPromise.then(onGetNodegroup).finally(function() {
      ctrl.loading = false;
    });

    function onGetNodegroup(response) {
      ctrl.nodegroup = response.data;
    }

    function objLen(obj) {
      return obj && typeof obj === 'object' ? Object.keys(obj).length : 0;
    }
  }
})();
