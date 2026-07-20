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

  describe('horizon.dashboard.container-infra.clusters.nodegroups.edit-labels-taints.service',
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
          'horizon.dashboard.container-infra.clusters.nodegroups.edit-labels-taints.service');
        magnum = $injector.get('horizon.app.core.openstack-service-api.magnum');

        var updateDeferred = $q.defer();
        updateDeferred.resolve({data: {}});
        spyOn(magnum, 'updateNodegroup').and.returnValue(updateDeferred.promise);
        spyOn(modal, 'open').and.callThrough();
      }));

      it('prefills the current node labels and taints and updates them', function() {
        var ng = {
          id: '2',
          name: 'extra',
          node_labels: {workload: 'cpu'},
          node_taints: [{key: 'gpu', value: 'true', effect: 'NoSchedule'}]
        };
        service.perform('c1', ng);

        expect(modal.open).toHaveBeenCalled();
        expect(modalConfig.model.node_labels).toBe('workload=cpu');
        expect(modalConfig.model.node_taints).toBe('gpu=true:NoSchedule');

        modalConfig.model.node_labels = 'workload=gpu';
        modalConfig.model.node_taints = '';
        openDeferred.resolve();
        $scope.$apply();

        expect(magnum.updateNodegroup).toHaveBeenCalledWith('c1', '2', {
          node_labels: 'workload=gpu',
          node_taints: ''
        });
      });

      it('prefills empty fields for a nodegroup without labels or taints', function() {
        service.perform('c1', {id: '3', name: 'plain'});

        expect(modalConfig.model.node_labels).toBe('');
        expect(modalConfig.model.node_taints).toBe('');
      });
    });
})();
