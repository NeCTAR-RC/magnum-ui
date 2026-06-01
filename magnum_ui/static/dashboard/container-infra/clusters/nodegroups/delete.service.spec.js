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

  describe('horizon.dashboard.container-infra.clusters.nodegroups.delete.service',
    function() {
      var service, $scope, $q, magnum, simpleModal, resultDeferred;
      var modalStub = {
        modal: function() {
          resultDeferred = $q.defer();
          return {result: resultDeferred.promise};
        }
      };

      beforeEach(module('horizon.app.core'));
      beforeEach(module('horizon.framework'));
      beforeEach(module('horizon.dashboard.container-infra.clusters'));
      beforeEach(module(function($provide) {
        $provide.value(
          'horizon.framework.widgets.modal.simple-modal.service', modalStub);
      }));

      beforeEach(inject(function($injector, _$rootScope_, _$q_) {
        $q = _$q_;
        $scope = _$rootScope_.$new();
        service = $injector.get(
          'horizon.dashboard.container-infra.clusters.nodegroups.delete.service');
        magnum = $injector.get('horizon.app.core.openstack-service-api.magnum');
        simpleModal = $injector.get(
          'horizon.framework.widgets.modal.simple-modal.service');

        var deleteDeferred = $q.defer();
        deleteDeferred.resolve({data: {}});
        spyOn(magnum, 'deleteNodegroup').and.returnValue(deleteDeferred.promise);
        spyOn(modalStub, 'modal').and.callThrough();
      }));

      it('confirms then deletes a non-default nodegroup', function() {
        var ng = {id: '2', name: 'extra', is_default: false};
        service.perform('c1', ng);

        expect(simpleModal.modal).toHaveBeenCalled();
        resultDeferred.resolve();
        $scope.$apply();

        expect(magnum.deleteNodegroup).toHaveBeenCalledWith('c1', '2');
      });

      it('refuses to delete a default nodegroup', function() {
        var ng = {id: '1', name: 'default-worker', is_default: true};
        var rejected = false;
        service.perform('c1', ng).then(angular.noop, function() {
          rejected = true;
        });
        $scope.$apply();

        expect(simpleModal.modal).not.toHaveBeenCalled();
        expect(magnum.deleteNodegroup).not.toHaveBeenCalled();
        expect(rejected).toBe(true);
      });
    });
})();
