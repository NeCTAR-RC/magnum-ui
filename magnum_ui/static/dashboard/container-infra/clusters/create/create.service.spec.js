/**
 *    (c) Copyright 2016 NEC Corporation
 *
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

  describe('horizon.dashboard.container-infra.clusters.create.service', function() {

    var service, $scope, $q, deferred, magnum, workflow, spinnerModal, modalConfig, configDeferred,
      $httpBackend;

    var model = {
      id: 1,
      auto_scaling_enabled: true,
      templateLabels: {key1:'default value'},
      etcd_separate_volume: true,
      etcd_volume_size: 20,
      etcd_blockdevice_volume_type: 'b1.standard',
      master_count: 1,
      create_network: true,
      addons: [{labels:{}},{labels:{}}],
      ingress_controller: {labels:{ingress_controller:''}},
      DEFAULTS: {}
    };
    var modal = {
      open: function(config) {
        deferred = $q.defer();
        deferred.resolve(config);
        modalConfig = config;

        return deferred.promise;
      }
    };

    ///////////////////

    beforeEach(module('horizon.app.core'));
    beforeEach(module('horizon.framework'));
    beforeEach(module('horizon.dashboard.container-infra.clusters'));

    beforeEach(module(function($provide) {
      $provide.value('horizon.framework.widgets.form.ModalFormService', modal);
    }));

    beforeEach(inject(function($injector, _$rootScope_, _$q_, _$httpBackend_) {
      $q = _$q_;
      $httpBackend = _$httpBackend_;
      $scope = _$rootScope_.$new();
      service = $injector.get('horizon.dashboard.container-infra.clusters.create.service');
      magnum = $injector.get('horizon.app.core.openstack-service-api.magnum');
      workflow = $injector.get('horizon.dashboard.container-infra.clusters.workflow');

      spinnerModal = $injector.get('horizon.framework.widgets.modal-wait-spinner.service');
      spyOn(spinnerModal, 'showModalSpinner').and.callFake(function() {});
      spyOn(spinnerModal, 'hideModalSpinner').and.callFake(function() {});

      deferred = $q.defer();
      deferred.resolve({data: {uuid: 1}});

      configDeferred = $q.defer();
      configDeferred.resolve({
        title: 'Create New Cluster',
        schema: {},
        form: {},
        model: model
      });

      spyOn(magnum, 'createCluster').and.returnValue(deferred.promise);
      spyOn(workflow, 'init').and.returnValue(configDeferred.promise);
      spyOn(modal, 'open').and.callThrough();
    }));

    it('should check the policy if the user is allowed to create cluster', function() {
      var allowed = service.allowed();
      expect(allowed).toBeTruthy();
    });

    it('should open the modal, hide the loading spinner and have valid ' +
      'form model', inject(function($timeout) {
        service.perform(null, $scope);

        $timeout(function() {
          expect(modal.open).toHaveBeenCalled();
          expect(magnum.createCluster).toHaveBeenCalled();
          // etcd-on-separate-volume selections are sent as labels
          var labels = magnum.createCluster.calls.argsFor(0)[0].labels;
          expect(labels.etcd_volume_size).toBe(20);
          expect(labels.etcd_blockdevice_volume_type).toBe('b1.standard');
          // Check if the form's model skeleton is correct
          expect(modalConfig.model).toBeDefined();
          expect(modalConfig.schema).toBeDefined();
          expect(modalConfig.form).toBeDefined();
          expect(modalConfig.title).toEqual('Create New Cluster');
        }, 0);

        $httpBackend.expectGET('/static/dashboard/container-infra/clusters/panel.html').respond({});
        $timeout.flush();
        $scope.$apply();
      }));

    it('should omit the etcd volume type label when it is left blank',
      inject(function($timeout) {
        model.etcd_separate_volume = true;
        model.etcd_volume_size = 30;
        model.etcd_blockdevice_volume_type = '';

        service.perform(null, $scope);

        $timeout(function() {
          var labels = magnum.createCluster.calls.argsFor(0)[0].labels;
          expect(labels.etcd_volume_size).toBe(30);
          expect(labels.hasOwnProperty('etcd_blockdevice_volume_type')).toBe(false);
        }, 0);

        $httpBackend.expectGET('/static/dashboard/container-infra/clusters/panel.html').respond({});
        $timeout.flush();
        $scope.$apply();
      }));

    it('should not crash unexpectedly with empty form model', inject(function($timeout) {
      model.auto_scaling_enabled = null;
      model.templateLabels = null;
      model.create_network = null;
      model.addons = null;
      model.etcd_separate_volume = null;

      service.perform(null, $scope);

      $httpBackend.expectGET('/static/dashboard/container-infra/clusters/panel.html').respond({});
      $timeout.flush();
      $scope.$apply();
    }));
  });
})();
