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

  describe('horizon.dashboard.container-infra.clusters.nodegroups.create.service',
    function() {
      var service, $scope, $q, magnum, nova, spinnerModal, modalConfig, openDeferred;
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
          'horizon.dashboard.container-infra.clusters.nodegroups.create.service');
        magnum = $injector.get('horizon.app.core.openstack-service-api.magnum');
        nova = $injector.get('horizon.app.core.openstack-service-api.nova');
        spinnerModal = $injector.get(
          'horizon.framework.widgets.modal-wait-spinner.service');
        spyOn(spinnerModal, 'showModalSpinner').and.callFake(angular.noop);
        spyOn(spinnerModal, 'hideModalSpinner').and.callFake(angular.noop);

        var flavorDeferred = $q.defer();
        flavorDeferred.resolve({data: {items: [{name: 'm1.small'}, {name: 'm1.large'}]}});
        spyOn(nova, 'getFlavors').and.returnValue(flavorDeferred.promise);

        var createDeferred = $q.defer();
        createDeferred.resolve({data: {}});
        spyOn(magnum, 'createNodegroup').and.returnValue(createDeferred.promise);
        spyOn(modal, 'open').and.callThrough();
      }));

      it('loads flavors, opens the modal and creates a worker nodegroup', function() {
        service.perform('c1');
        $scope.$apply();

        expect(nova.getFlavors).toHaveBeenCalled();
        expect(modal.open).toHaveBeenCalled();
        expect(modalConfig.title).toBeDefined();

        modalConfig.model.name = 'ng1';
        modalConfig.model.flavor_id = 'm1.small';
        modalConfig.model.node_count = 2;
        openDeferred.resolve();
        $scope.$apply();

        expect(magnum.createNodegroup).toHaveBeenCalledWith('c1', {
          name: 'ng1',
          flavor_id: 'm1.small',
          node_count: 2,
          role: 'worker'
        });
      });

      it('includes autoscaling bounds and label when enabled', function() {
        service.perform('c1');
        $scope.$apply();

        modalConfig.model.name = 'ng1';
        modalConfig.model.flavor_id = 'm1.large';
        modalConfig.model.node_count = 3;
        modalConfig.model.auto_scaling_enabled = true;
        modalConfig.model.min_node_count = 1;
        modalConfig.model.max_node_count = 5;
        openDeferred.resolve();
        $scope.$apply();

        expect(magnum.createNodegroup).toHaveBeenCalledWith('c1', {
          name: 'ng1',
          flavor_id: 'm1.large',
          node_count: 3,
          role: 'worker',
          min_node_count: 1,
          max_node_count: 5,
          labels: {auto_scaling_enabled: true}
        });
      });

      it('merges autoscaling and boot-from-volume labels', function() {
        service.perform('c1');
        $scope.$apply();

        modalConfig.model.name = 'ng1';
        modalConfig.model.flavor_id = 'm1.large';
        modalConfig.model.node_count = 3;
        modalConfig.model.auto_scaling_enabled = true;
        modalConfig.model.min_node_count = 1;
        modalConfig.model.max_node_count = 5;
        modalConfig.model.boot_from_volume = true;
        modalConfig.model.boot_volume_size = 50;
        openDeferred.resolve();
        $scope.$apply();

        expect(magnum.createNodegroup).toHaveBeenCalledWith('c1', {
          name: 'ng1',
          flavor_id: 'm1.large',
          node_count: 3,
          role: 'worker',
          min_node_count: 1,
          max_node_count: 5,
          labels: {auto_scaling_enabled: true, boot_volume_size: 50}
        });
      });

      it('sends node labels and taints when provided', function() {
        service.perform('c1');
        $scope.$apply();

        modalConfig.model.name = 'ng1';
        modalConfig.model.flavor_id = 'm1.small';
        modalConfig.model.node_count = 2;
        modalConfig.model.node_labels = 'workload=gpu';
        modalConfig.model.node_taints = 'gpu=true:NoSchedule';
        openDeferred.resolve();
        $scope.$apply();

        expect(magnum.createNodegroup).toHaveBeenCalledWith('c1', {
          name: 'ng1',
          flavor_id: 'm1.small',
          node_count: 2,
          role: 'worker',
          node_labels: 'workload=gpu',
          node_taints: 'gpu=true:NoSchedule'
        });
      });

      it('sends boot-from-volume labels when enabled', function() {
        service.perform('c1');
        $scope.$apply();

        modalConfig.model.name = 'ng1';
        modalConfig.model.flavor_id = 'm1.small';
        modalConfig.model.node_count = 2;
        modalConfig.model.boot_from_volume = true;
        modalConfig.model.boot_volume_size = 50;
        modalConfig.model.boot_volume_type = 'ssd';
        openDeferred.resolve();
        $scope.$apply();

        expect(magnum.createNodegroup).toHaveBeenCalledWith('c1', {
          name: 'ng1',
          flavor_id: 'm1.small',
          node_count: 2,
          role: 'worker',
          labels: {boot_volume_size: 50, boot_volume_type: 'ssd'}
        });
      });

      it('omits the boot volume type label when left blank', function() {
        service.perform('c1');
        $scope.$apply();

        modalConfig.model.name = 'ng1';
        modalConfig.model.flavor_id = 'm1.small';
        modalConfig.model.node_count = 2;
        modalConfig.model.boot_from_volume = true;
        modalConfig.model.boot_volume_size = 50;
        openDeferred.resolve();
        $scope.$apply();

        expect(magnum.createNodegroup).toHaveBeenCalledWith('c1', {
          name: 'ng1',
          flavor_id: 'm1.small',
          node_count: 2,
          role: 'worker',
          labels: {boot_volume_size: 50}
        });
      });
    });
})();
