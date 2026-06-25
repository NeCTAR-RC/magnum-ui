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

  describe('horizon.dashboard.container-infra.clusters.workflow', function() {
    var workflow, magnum, nova, $scope, $q, $timeout, deferred,
      controllersDeferred, controllersResponse, addonsResponse,
      addonDeferred, templatesDeferred;

    beforeEach(module('horizon.app.core'));
    beforeEach(module('horizon.framework'));
    beforeEach(module('horizon.dashboard.container-infra.clusters'));

    beforeEach(inject(function($injector, _$rootScope_, _$q_, _$timeout_) {
      $q = _$q_;
      $timeout = _$timeout_;
      $scope = _$rootScope_.$new();

      workflow = $injector.get(
        'horizon.dashboard.container-infra.clusters.workflow');
      magnum = $injector.get('horizon.app.core.openstack-service-api.magnum');
      nova = $injector.get('horizon.app.core.openstack-service-api.nova');

      deferred = $q.defer();
      deferred.resolve({data:{items:{1:{name:1},2:{name:2}}}});

      controllersResponse = {controllers:[
        {name: 'Controller1', labels:{ingress_controller:'ic1'}},
        {name: 'Controller2', labels:{ingress_controller:'ic2'}},
        {name: 'Controller3', labels:{ingress_controller:'ic3'}},
      ]};
      controllersDeferred = $q.defer();
      controllersDeferred.resolve({data: controllersResponse});

      addonsResponse = {addons:[
        {name: 'Addon1', labels:{}, selected: false},
        {name: 'Addon2', labels:{}, selected: true},
        {name: 'Addon3', labels:{}, selected: true},
      ]};
      addonDeferred = $q.defer();
      addonDeferred.resolve({data: addonsResponse});

      // Templates named per convention:
      //   kubernetes-v{k8sVersion}-{availabilityZone}-{networkDriver}-v{templateVersion}
      // 'melbourne-qh2' exercises a dashed availability zone; a/b share a combo with
      // different template versions (tie-break -> highest wins); 'e' is non-conforming.
      templatesDeferred = $q.defer();
      templatesDeferred.resolve({data:{items:[
        {id:'a', name:'kubernetes-v1.27.4-melbourne-qh2-calico-v3', network_driver:'calico'},
        {id:'b', name:'kubernetes-v1.27.4-melbourne-qh2-calico-v5', network_driver:'calico'},
        {id:'c', name:'kubernetes-v1.27.4-melbourne-qh2-flannel-v1', network_driver:'flannel'},
        {id:'d', name:'kubernetes-v1.28.0-sydney-s1-calico-v2', network_driver:'calico'},
        {id:'e', name:'not-a-k8s-template'}
      ]}});

      spyOn(magnum, 'getClusterTemplates').and.returnValue(templatesDeferred.promise);
      spyOn(magnum, 'getIngressControllers').and.returnValue(controllersDeferred.promise);
      spyOn(magnum, 'getAddons').and.returnValue(addonDeferred.promise);
      spyOn(nova, 'getFlavors').and.returnValue(deferred.promise);
    }));

    function initWorkflow() {
      var config;
      workflow.init('Create Cluster', $scope).then(function(conf) { config = conf; });
      $timeout.flush();
      return config;
    }

    function optionValues(titleMap) {
      return titleMap.map(function(option) { return option.value; });
    }

    // Details tab items: [name, k8sVersion, availabilityZone, networkDriver, summary]
    function detailsItems(config) {
      return config.form[0].tabs[0].items[0].items;
    }

    it('should be initialised', function() {
      var config = initWorkflow();

      expect(config.title).toBeDefined();
      expect(config.schema).toBeDefined();
      expect(config.form).toBeDefined();
      expect(config.model).toBeDefined();
      expect($scope.model).toBeDefined();
      expect($scope.model.DEFAULTS).toBeDefined();

      expect(config.model.ingressControllers).toBe(controllersResponse.controllers);
      expect(config.model.addons.length).toBe(2);
    });

    it('should build kubernetes version options newest-first and skip ' +
      'non-conforming templates', function() {
      var config = initWorkflow();
      var k8sField = detailsItems(config)[1];

      expect(optionValues(k8sField.titleMap)).toEqual(['', '1.28.0', '1.27.4']);
    });

    it('should cascade selections and derive the highest-version template', function() {
      var config = initWorkflow();
      var items = detailsItems(config);
      var k8sField = items[1];
      var azField = items[2];
      var driverField = items[3];
      var model = config.model;

      model.k8s_version = '1.27.4';
      k8sField.onChange();

      // Only one AZ for 1.27.4, so it auto-selects and cascades to drivers.
      expect(optionValues(azField.titleMap)).toEqual(['', 'melbourne-qh2']);
      expect(model.availability_zone).toBe('melbourne-qh2');
      expect(optionValues(driverField.titleMap)).toEqual(['', 'calico', 'flannel']);

      model.network_driver = 'calico';
      driverField.onChange();
      // 'a' (v3) and 'b' (v5) match -> highest template version wins.
      expect(model.cluster_template_id).toBe('b');

      model.network_driver = 'flannel';
      driverField.onChange();
      expect(model.cluster_template_id).toBe('c');
    });

    it('should reset and re-derive lower selections when the k8s version changes',
      function() {
        var config = initWorkflow();
        var k8sField = detailsItems(config)[1];
        var model = config.model;

        // 1.28.0 has a single AZ (sydney-s1) and single driver (calico): full auto-cascade.
        model.k8s_version = '1.28.0';
        k8sField.onChange();

        expect(model.availability_zone).toBe('sydney-s1');
        expect(model.network_driver).toBe('calico');
        expect(model.cluster_template_id).toBe('d');
      });

    it('should auto-select and derive when a single option exists at each level',
      function() {
        var singleDeferred = $q.defer();
        singleDeferred.resolve({data:{items:[
          {id:'only', name:'kubernetes-v1.30.0-tasman-z1-cilium-v1', network_driver:'cilium'}
        ]}});
        magnum.getClusterTemplates.and.returnValue(singleDeferred.promise);

        var model = initWorkflow().model;

        expect(model.k8s_version).toBe('1.30.0');
        expect(model.availability_zone).toBe('tasman-z1');
        expect(model.network_driver).toBe('cilium');
        expect(model.cluster_template_id).toBe('only');
      });

    it('should leave cluster_template_id empty when there are no templates', function() {
      var emptyDeferred = $q.defer();
      emptyDeferred.resolve({data:{items:[]}});
      magnum.getClusterTemplates.and.returnValue(emptyDeferred.promise);

      var config = initWorkflow();

      expect(config.model.cluster_template_id).toBe('');
      expect(optionValues(detailsItems(config)[1].titleMap)).toEqual(['']);
    });

  });
})();
