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

  describe('horizon.dashboard.container-infra.clusters.nodegroups.manage.service', function() {
    var service, $location, detailRoute, spinner;

    beforeEach(module('horizon.app.core'));
    beforeEach(module('horizon.framework'));
    beforeEach(module('horizon.dashboard.container-infra'));
    beforeEach(module('horizon.dashboard.container-infra.clusters'));

    beforeEach(inject(function($injector) {
      service = $injector.get(
        'horizon.dashboard.container-infra.clusters.nodegroups.manage.service');
      $location = $injector.get('$location');
      detailRoute = $injector.get('horizon.app.core.detailRoute');
      spinner = $injector.get('horizon.framework.widgets.modal-wait-spinner.service');
    }));

    it('navigates to the cluster detail page on the node groups tab', function() {
      spyOn($location, 'path').and.callThrough();
      spyOn($location, 'search').and.callThrough();

      service.perform({id: 'abc123'});

      expect($location.path).toHaveBeenCalledWith(
        '/' + detailRoute + 'OS::Magnum::Cluster/abc123');
      expect($location.search).toHaveBeenCalledWith('tab', 'nodegroups');
    });

    it('shows the wait spinner before navigating', function() {
      spyOn(spinner, 'showModalSpinner');

      service.perform({id: 'abc123'});

      expect(spinner.showModalSpinner).toHaveBeenCalled();
    });

    it('is always allowed', function() {
      var allowed = false;
      service.allowed().then(function() { allowed = true; });
      // booleanAsPromise resolves on the next digest.
      inject(function($rootScope) { $rootScope.$apply(); });
      expect(allowed).toBe(true);
    });

    it('exposes a no-op initAction', function() {
      expect(service.initAction).not.toThrow();
    });
  });
})();
