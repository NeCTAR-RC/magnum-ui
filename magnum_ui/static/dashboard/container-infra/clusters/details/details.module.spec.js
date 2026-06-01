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

  describe('node group detail registration', function() {
    var registry, magnum;

    beforeEach(module('horizon.dashboard.container-infra.clusters'));

    beforeEach(inject(function($injector) {
      registry = $injector.get(
        'horizon.framework.conf.resource-type-registry.service');
      magnum = $injector.get('horizon.app.core.openstack-service-api.magnum');
    }));

    it('parses and generates the composite nodegroup path', function() {
      var rt = registry.getResourceType('OS::Magnum::NodeGroup');
      expect(rt.parsePath('c1/n1')).toEqual({clusterId: 'c1', nodegroupId: 'n1'});
      expect(rt.path({cluster_id: 'c1', id: 'n1'})).toBe('c1/n1');
    });

    it('loads a nodegroup via the magnum service', function() {
      spyOn(magnum, 'getNodegroup').and.returnValue('promise');
      var rt = registry.getResourceType('OS::Magnum::NodeGroup');
      expect(rt.load({clusterId: 'c1', nodegroupId: 'n1'})).toBe('promise');
      expect(magnum.getNodegroup).toHaveBeenCalledWith('c1', 'n1');
    });
  });
})();
