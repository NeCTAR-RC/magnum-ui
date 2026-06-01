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

  describe('horizon.dashboard.container-infra.clusters.nodegroups.resize.service',
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
          'horizon.dashboard.container-infra.clusters.nodegroups.resize.service');
        magnum = $injector.get('horizon.app.core.openstack-service-api.magnum');

        var resizeDeferred = $q.defer();
        resizeDeferred.resolve({data: {}});
        spyOn(magnum, 'resizeCluster').and.returnValue(resizeDeferred.promise);
        spyOn(modal, 'open').and.callThrough();
      }));

      it('resizes the selected nodegroup via the cluster resize API', function() {
        var ng = {id: '2', name: 'extra', node_count: 3};
        service.perform('c1', ng);

        expect(modal.open).toHaveBeenCalled();
        expect(modalConfig.model.node_count).toBe(3);

        modalConfig.model.node_count = 5;
        openDeferred.resolve();
        $scope.$apply();

        expect(magnum.resizeCluster).toHaveBeenCalledWith('c1', {
          node_count: 5,
          nodegroup: 'extra'
        });
      });
    });
})();
