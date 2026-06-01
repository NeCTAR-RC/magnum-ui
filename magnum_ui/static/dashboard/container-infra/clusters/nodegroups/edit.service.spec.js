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

  describe('horizon.dashboard.container-infra.clusters.nodegroups.edit.service',
    function() {
      var service, $scope, $q, magnum, modalConfig, openDeferred;
      var modal = {
        open: function(config) {
          modalConfig = config;
          openDeferred = $q.defer();
          return openDeferred.promise;
        }
      };

      beforeEach(module('horizon.app.core'));
      beforeEach(module('horizon.framework'));
      beforeEach(module('horizon.dashboard.container-infra.clusters'));
      beforeEach(module(function($provide) {
        $provide.value('horizon.framework.widgets.form.ModalFormService', modal);
      }));

      beforeEach(inject(function($injector, _$rootScope_, _$q_) {
        $q = _$q_;
        $scope = _$rootScope_.$new();
        service = $injector.get(
          'horizon.dashboard.container-infra.clusters.nodegroups.edit.service');
        magnum = $injector.get('horizon.app.core.openstack-service-api.magnum');

        var updateDeferred = $q.defer();
        updateDeferred.resolve({data: {}});
        spyOn(magnum, 'updateNodegroup').and.returnValue(updateDeferred.promise);
        spyOn(modal, 'open').and.callThrough();
      }));

      it('updates the nodegroup autoscaling bounds', function() {
        var ng = {id: '2', name: 'extra', min_node_count: 1, max_node_count: 5};
        service.perform('c1', ng);

        expect(modal.open).toHaveBeenCalled();
        expect(modalConfig.model.min_node_count).toBe(1);
        expect(modalConfig.model.max_node_count).toBe(5);

        modalConfig.model.min_node_count = 2;
        modalConfig.model.max_node_count = 6;
        openDeferred.resolve();
        $scope.$apply();

        expect(magnum.updateNodegroup).toHaveBeenCalledWith('c1', '2', {
          min_node_count: 2,
          max_node_count: 6
        });
      });
    });
})();
