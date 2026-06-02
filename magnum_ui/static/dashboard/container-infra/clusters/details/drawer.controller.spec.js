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

  describe('cluster drawer controller', function() {

    var $controller, $rootScope, $q, magnum, deferred;

    beforeEach(module('horizon.app.core'));
    beforeEach(module('horizon.framework'));
    beforeEach(module('horizon.dashboard.container-infra.clusters'));

    beforeEach(inject(function(_$controller_, _$rootScope_, _$q_, $injector) {
      $controller = _$controller_;
      $rootScope = _$rootScope_;
      $q = _$q_;
      magnum = $injector.get('horizon.app.core.openstack-service-api.magnum');
      deferred = $q.defer();
      spyOn(magnum, 'getClusterTemplate').and.returnValue(deferred.promise);
    }));

    function createController(item) {
      var scope = $rootScope.$new();
      scope.item = item;
      return $controller(
        'horizon.dashboard.container-infra.clusters.DrawerController',
        {$scope: scope});
    }

    it('derives availability zone and network driver from the cluster template',
      function() {
        var ctrl = createController({cluster_template_id: 'ct1'});
        expect(magnum.getClusterTemplate).toHaveBeenCalledWith('ct1');
        deferred.resolve({data: {
          name: 'kubernetes-v1.27.3-melbourne-qh2-calico-v3',
          network_driver: 'calico'
        }});
        $rootScope.$apply();
        expect(ctrl.availabilityZone).toBe('melbourne-qh2');
        expect(ctrl.networkDriver).toBe('calico');
      });

    it('falls back to the parsed network driver when the field is unset',
      function() {
        var ctrl = createController({cluster_template_id: 'ct1'});
        deferred.resolve({data: {
          name: 'kubernetes-v1.27.3-melbourne-qh2-flannel-v3',
          network_driver: null
        }});
        $rootScope.$apply();
        expect(ctrl.networkDriver).toBe('flannel');
      });

    it('leaves the availability zone empty for a non-conforming template name',
      function() {
        var ctrl = createController({cluster_template_id: 'ct1'});
        deferred.resolve({data: {name: 'custom-template', network_driver: 'calico'}});
        $rootScope.$apply();
        expect(ctrl.availabilityZone).toBe('');
        expect(ctrl.networkDriver).toBe('calico');
      });

    it('does nothing when the cluster has no template', function() {
      var ctrl = createController({});
      expect(magnum.getClusterTemplate).not.toHaveBeenCalled();
      expect(ctrl.availabilityZone).toBe('');
      expect(ctrl.networkDriver).toBe('');
    });

    it('handles a failed template lookup gracefully', function() {
      var ctrl = createController({cluster_template_id: 'ct1'});
      deferred.resolve();
      $rootScope.$apply();
      expect(ctrl.availabilityZone).toBe('');
      expect(ctrl.networkDriver).toBe('');
    });
  });
})();
