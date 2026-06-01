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

  describe('node group overview controller', function() {
    var ctrl, $q, $rootScope, deferred;

    beforeEach(module('horizon.dashboard.container-infra.clusters'));

    beforeEach(inject(function($controller, _$q_, _$rootScope_) {
      $q = _$q_;
      $rootScope = _$rootScope_;
      deferred = $q.defer();
      deferred.resolve({data: {name: 'ng1', labels: {a: 'b'},
        node_addresses: ['1.2.3.4']}});
      ctrl = $controller('NodeGroupOverviewController',
        {'$scope': {context: {loadPromise: deferred.promise}}});
    }));

    it('sets the nodegroup from the load promise', function() {
      $rootScope.$apply();
      expect(ctrl.nodegroup.name).toBe('ng1');
    });

    it('objLen counts keys of objects and arrays', function() {
      expect(ctrl.objLen()).toBe(0);
      expect(ctrl.objLen(null)).toBe(0);
      expect(ctrl.objLen({a: 1, b: 2})).toBe(2);
      expect(ctrl.objLen(['x'])).toBe(1);
    });
  });
})();
