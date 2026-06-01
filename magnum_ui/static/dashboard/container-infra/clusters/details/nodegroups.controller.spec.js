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
    var $controller, $scope, $q, magnum,
      createService, resizeService, editService, deleteService;

    beforeEach(module('horizon.app.core'));
    beforeEach(module('horizon.framework'));
    beforeEach(module('horizon.dashboard.container-infra.clusters'));

    beforeEach(inject(function($injector, _$rootScope_, _$q_, _$controller_) {
      $q = _$q_;
      $controller = _$controller_;
      $scope = _$rootScope_.$new();
      magnum = $injector.get('horizon.app.core.openstack-service-api.magnum');
      createService = $injector.get(
        'horizon.dashboard.container-infra.clusters.nodegroups.create.service');
      resizeService = $injector.get(
        'horizon.dashboard.container-infra.clusters.nodegroups.resize.service');
      editService = $injector.get(
        'horizon.dashboard.container-infra.clusters.nodegroups.edit.service');
      deleteService = $injector.get(
        'horizon.dashboard.container-infra.clusters.nodegroups.delete.service');
    }));

    function createController(status) {
      var listDeferred = $q.defer();
      listDeferred.resolve({data: {items: [
        {id: '1', name: 'default-worker', is_default: true},
        {id: '2', name: 'extra', is_default: false}
      ]}});
      spyOn(magnum, 'getNodegroups').and.returnValue(listDeferred.promise);

      var loadDeferred = $q.defer();
      loadDeferred.resolve({data: {status: status || 'CREATE_COMPLETE'}});

      $scope.context = {identifier: 'c1', loadPromise: loadDeferred.promise};

      return $controller('ClusterNodegroupsController', {$scope: $scope});
    }

    it('loads the nodegroups and enables actions for a stable status', function() {
      var ctrl = createController('UPDATE_COMPLETE');
      $scope.$apply();

      expect(magnum.getNodegroups).toHaveBeenCalledWith('c1');
      expect(ctrl.nodegroups.length).toBe(2);
      expect(ctrl.actionsEnabled).toBe(true);
    });

    it('disables actions when the cluster status is not stable', function() {
      var ctrl = createController('UPDATE_IN_PROGRESS');
      $scope.$apply();
      expect(ctrl.actionsEnabled).toBe(false);
    });

    it('runs each action and reloads the list on success', function() {
      var actionDeferred = $q.defer();
      actionDeferred.resolve();
      spyOn(createService, 'perform').and.returnValue(actionDeferred.promise);
      spyOn(resizeService, 'perform').and.returnValue(actionDeferred.promise);
      spyOn(editService, 'perform').and.returnValue(actionDeferred.promise);
      spyOn(deleteService, 'perform').and.returnValue(actionDeferred.promise);

      var ctrl = createController();
      $scope.$apply();
      magnum.getNodegroups.calls.reset();

      var ng = ctrl.nodegroups[1];
      ctrl.createNodegroup();
      ctrl.resizeNodegroup(ng);
      ctrl.editNodegroup(ng);
      ctrl.deleteNodegroup(ng);
      $scope.$apply();

      var createArgs = createService.perform.calls.argsFor(0);
      expect(createArgs[0]).toBe('c1');
      expect(createArgs[1]).toBeUndefined();
      expect(createArgs[2]).toBe($scope);
      expect(resizeService.perform).toHaveBeenCalledWith('c1', ng, $scope);
      expect(editService.perform).toHaveBeenCalledWith('c1', ng, $scope);
      expect(deleteService.perform).toHaveBeenCalledWith('c1', ng, $scope);
      // Each successful action triggers a reload.
      expect(magnum.getNodegroups.calls.count()).toBe(4);
    });
  });
})();
