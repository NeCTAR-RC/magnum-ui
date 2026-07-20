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

  describe('ClusterNodegroupsController', function() {
    var $controller, $scope, $q, $location, $timeout, $element, magnum,
      createService, resizeService, editService, editLabelsTaintsService,
      deleteService;

    beforeEach(module('horizon.app.core'));
    beforeEach(module('horizon.framework'));
    beforeEach(module('horizon.dashboard.container-infra.clusters'));

    beforeEach(inject(function($injector, _$rootScope_, _$q_, _$controller_,
      _$location_, _$timeout_) {
      $q = _$q_;
      $controller = _$controller_;
      $location = _$location_;
      $timeout = _$timeout_;
      $element = angular.element('<div></div>');
      $scope = _$rootScope_.$new();
      magnum = $injector.get('horizon.app.core.openstack-service-api.magnum');
      createService = $injector.get(
        'horizon.dashboard.container-infra.clusters.nodegroups.create.service');
      resizeService = $injector.get(
        'horizon.dashboard.container-infra.clusters.nodegroups.resize.service');
      editService = $injector.get(
        'horizon.dashboard.container-infra.clusters.nodegroups.edit.service');
      editLabelsTaintsService = $injector.get(
        'horizon.dashboard.container-infra.clusters.nodegroups.edit-labels-taints.service');
      deleteService = $injector.get(
        'horizon.dashboard.container-infra.clusters.nodegroups.delete.service');
    }));

    function createController(status, clusterLabels) {
      var listDeferred = $q.defer();
      listDeferred.resolve({data: {items: [
        {id: '1', name: 'default-worker', is_default: true},
        {id: '2', name: 'extra', is_default: false}
      ]}});
      spyOn(magnum, 'getNodegroups').and.returnValue(listDeferred.promise);

      var loadDeferred = $q.defer();
      loadDeferred.resolve({data: {
        status: status || 'CREATE_COMPLETE',
        labels: clusterLabels
      }});

      $scope.context = {identifier: 'c1', loadPromise: loadDeferred.promise};

      return $controller('ClusterNodegroupsController',
        {$scope: $scope, $element: $element});
    }

    it('loads the nodegroups and enables actions for a stable status', function() {
      var ctrl = createController('UPDATE_COMPLETE');
      $scope.$apply();

      expect(magnum.getNodegroups).toHaveBeenCalledWith('c1');
      expect(ctrl.nodegroups.length).toBe(2);
      expect(ctrl.actionsEnabled).toBe(true);
    });

    it('reports loading until the nodegroups resolve', function() {
      var ctrl = createController();
      // The list is still in flight right after construction.
      expect(ctrl.loading).toBe(true);
      $scope.$apply();
      expect(ctrl.loading).toBe(false);
    });

    it('disables actions when the cluster status is not stable', function() {
      var ctrl = createController('UPDATE_IN_PROGRESS');
      $scope.$apply();
      expect(ctrl.actionsEnabled).toBe(false);
    });

    it('allows editing autoscaling when enabled cluster-wide', function() {
      // Magnum stores the label as the capitalised string 'True'.
      var ctrl = createController('CREATE_COMPLETE', {auto_scaling_enabled: 'True'});
      $scope.$apply();
      // Any nodegroup is editable because the label is set on the cluster.
      expect(ctrl.autoscalingEnabled({labels: {}})).toBe(true);
      expect(ctrl.autoscalingEnabled({})).toBe(true);
    });

    it('allows editing autoscaling when enabled on the nodegroup itself', function() {
      var ctrl = createController('CREATE_COMPLETE', {});
      $scope.$apply();
      // The label is matched case-insensitively: Magnum's str(True) is 'True'.
      expect(ctrl.autoscalingEnabled({labels: {auto_scaling_enabled: 'True'}})).toBe(true);
      expect(ctrl.autoscalingEnabled({labels: {auto_scaling_enabled: 'true'}})).toBe(true);
      // A boolean true label is also accepted.
      expect(ctrl.autoscalingEnabled({labels: {auto_scaling_enabled: true}})).toBe(true);
    });

    it('disallows editing autoscaling when the label is absent or not true', function() {
      var ctrl = createController('CREATE_COMPLETE');
      $scope.$apply();
      expect(ctrl.autoscalingEnabled({labels: {}})).toBe(false);
      expect(ctrl.autoscalingEnabled({labels: {auto_scaling_enabled: 'false'}})).toBe(false);
      expect(ctrl.autoscalingEnabled({})).toBe(false);
    });

    it('disallows editing labels and taints on master nodegroups', function() {
      var ctrl = createController();
      $scope.$apply();
      // Magnum rejects node labels/taints on master nodegroups; default and
      // extra worker nodegroups are both editable.
      expect(ctrl.labelsTaintsEditable({role: 'master', is_default: true})).toBe(false);
      expect(ctrl.labelsTaintsEditable({role: 'master', is_default: false})).toBe(false);
      expect(ctrl.labelsTaintsEditable({role: 'worker', is_default: true})).toBe(true);
      expect(ctrl.labelsTaintsEditable({role: 'worker', is_default: false})).toBe(true);
      expect(ctrl.labelsTaintsEditable({role: 'custom-role'})).toBe(true);
    });

    it('runs each action and reloads the list on success', function() {
      var actionDeferred = $q.defer();
      actionDeferred.resolve();
      spyOn(createService, 'perform').and.returnValue(actionDeferred.promise);
      spyOn(resizeService, 'perform').and.returnValue(actionDeferred.promise);
      spyOn(editService, 'perform').and.returnValue(actionDeferred.promise);
      spyOn(editLabelsTaintsService, 'perform')
        .and.returnValue(actionDeferred.promise);
      spyOn(deleteService, 'perform').and.returnValue(actionDeferred.promise);

      var ctrl = createController();
      $scope.$apply();
      magnum.getNodegroups.calls.reset();

      var ng = ctrl.nodegroups[1];
      ctrl.createNodegroup();
      ctrl.resizeNodegroup(ng);
      ctrl.editNodegroup(ng);
      ctrl.editNodegroupLabelsTaints(ng);
      ctrl.deleteNodegroup(ng);
      $scope.$apply();

      var createArgs = createService.perform.calls.argsFor(0);
      expect(createArgs[0]).toBe('c1');
      expect(createArgs[1]).toBeUndefined();
      expect(createArgs[2]).toBe($scope);
      expect(resizeService.perform).toHaveBeenCalledWith('c1', ng, $scope);
      expect(editService.perform).toHaveBeenCalledWith('c1', ng, $scope);
      expect(editLabelsTaintsService.perform)
        .toHaveBeenCalledWith('c1', ng, $scope);
      expect(deleteService.perform).toHaveBeenCalledWith('c1', ng, $scope);
      // Each successful action triggers a reload.
      expect(magnum.getNodegroups.calls.count()).toBe(5);
    });

    it('activates the node groups tab when deep-linked with ?tab=nodegroups', function() {
      var tabset = {active: 0};
      spyOn($location, 'search').and.returnValue({tab: 'nodegroups'});
      spyOn($element, 'controller').and.returnValue(tabset);
      $scope.views = [
        {id: 'clusterDetailsOverview'},
        {id: 'clusterDetailsNodegroups'}
      ];

      createController();
      $scope.$apply();
      $timeout.flush();

      expect($element.controller).toHaveBeenCalledWith('uibTabset');
      // Node Groups is the second view, so its tab index is 1.
      expect(tabset.active).toBe(1);
    });

    it('leaves the active tab alone without the ?tab=nodegroups marker', function() {
      spyOn($element, 'controller');

      createController();
      $scope.$apply();

      // No deferred tab switch was scheduled.
      expect(function() { $timeout.verifyNoPendingTasks(); }).not.toThrow();
      expect($element.controller).not.toHaveBeenCalled();
    });

    it('does nothing when the tabset or views are unavailable', function() {
      spyOn($location, 'search').and.returnValue({tab: 'nodegroups'});
      spyOn($element, 'controller').and.returnValue(null);

      createController();
      $scope.$apply();
      // No tabset and no $scope.views: the helper bails out without error.
      expect(function() { $timeout.flush(); }).not.toThrow();
    });
  });
})();
