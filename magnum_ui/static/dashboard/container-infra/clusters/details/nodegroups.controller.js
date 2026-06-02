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
   * @name ClusterNodegroupsController
   * @description
   * Controller for the "Node Groups" tab on the cluster detail page. Lists the
   * cluster's nodegroups and drives the create/resize/edit/delete modals,
   * reloading the list after each successful action.
   */
  angular
    .module('horizon.dashboard.container-infra.clusters')
    .controller('ClusterNodegroupsController', ClusterNodegroupsController);

  ClusterNodegroupsController.$inject = [
    '$scope',
    'horizon.app.core.openstack-service-api.magnum',
    'horizon.dashboard.container-infra.clusters.nodegroups.create.service',
    'horizon.dashboard.container-infra.clusters.nodegroups.resize.service',
    'horizon.dashboard.container-infra.clusters.nodegroups.edit.service',
    'horizon.dashboard.container-infra.clusters.nodegroups.delete.service'
  ];

  function ClusterNodegroupsController(
    $scope, magnum, createService, resizeService, editService, deleteService
  ) {
    var ctrl = this;

    // Cluster statuses in which nodegroup actions are allowed (mirrors the
    // statuses used to gate resize/upgrade in clusters.utils.js).
    var ALLOWED_STATUSES = [
      'CREATE_COMPLETE',
      'UPDATE_COMPLETE',
      'ROLLBACK_COMPLETE',
      'SNAPSHOT_COMPLETE',
      'CHECK_COMPLETE',
      'ADOPT_COMPLETE'
    ];

    ctrl.clusterId = $scope.context.identifier;
    ctrl.nodegroups = [];
    ctrl.actionsEnabled = false;
    ctrl.clusterLabels = {};
    ctrl.reload = reload;
    ctrl.createNodegroup = function() { run(createService); };
    ctrl.resizeNodegroup = function(nodegroup) { run(resizeService, nodegroup); };
    ctrl.editNodegroup = function(nodegroup) { run(editService, nodegroup); };
    ctrl.deleteNodegroup = function(nodegroup) { run(deleteService, nodegroup); };
    ctrl.autoscalingEnabled = autoscalingEnabled;

    $scope.context.loadPromise.then(function(response) {
      ctrl.actionsEnabled = ALLOWED_STATUSES.indexOf(response.data.status) > -1;
      ctrl.clusterLabels = response.data.labels || {};
    });

    reload();

    // Autoscaling can only be edited on a nodegroup when it was enabled via the
    // auto_scaling_enabled label, either cluster-wide or on the nodegroup itself.
    function autoscalingEnabled(nodegroup) {
      return labelTrue(ctrl.clusterLabels) ||
        labelTrue(nodegroup && nodegroup.labels);
    }

    // Magnum stores label values as strings, and Python's str(True) yields the
    // capitalised 'True', so compare case-insensitively rather than matching a
    // single literal.
    function labelTrue(labels) {
      return !!labels &&
        String(labels.auto_scaling_enabled).toLowerCase() === 'true';
    }

    function reload() {
      return magnum.getNodegroups(ctrl.clusterId).then(function(response) {
        ctrl.nodegroups = response.data.items;
      });
    }

    // Run an action modal, then reload the list on success. A cancelled modal
    // rejects, which the noop handler swallows (no reload).
    function run(service, nodegroup) {
      return service.perform(ctrl.clusterId, nodegroup, $scope)
        .then(reload, angular.noop);
    }
  }
})();
