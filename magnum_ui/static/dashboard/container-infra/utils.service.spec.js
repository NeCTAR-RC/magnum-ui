/**
 * Copyright 2017 NEC Corporation
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

  describe('horizon.dashboard.container-infra.utils.service', function() {

    var service;

    ///////////////////

    beforeEach(module('horizon.dashboard.container-infra'));
    beforeEach(inject(function($injector) {
      service = $injector.get(
        'horizon.dashboard.container-infra.utils.service');
    }));

    it('should compare two semver-based versions strings', function() {
      expect(service.versionCompare('1.2.2','1.2.2')).toBe(0);
      expect(service.versionCompare('1.2.3','1.2.2')).toBe(1);
      expect(service.versionCompare('1.2.2','1.2.3')).toBe(-1);

      expect(service.versionCompare('1.12.2','1.2.2')).toBe(1);
      expect(service.versionCompare('12.1.2','1.3.2')).toBe(1);
      expect(service.versionCompare('1.3.2','1.3.11')).toBe(-1);
    });

    it('should parse a conforming cluster template name', function() {
      expect(service.parseTemplateName('kubernetes-v1.15.6-prod-calico-v3')).toEqual({
        k8sVersion: '1.15.6',
        availabilityZone: 'prod',
        networkDriver: 'calico',
        templateVersion: '3'
      });
    });

    it('should parse an availability zone that contains dashes', function() {
      expect(service.parseTemplateName('kubernetes-v1.27.4-melbourne-qh2-calico-v3'))
        .toEqual({
          k8sVersion: '1.27.4',
          availabilityZone: 'melbourne-qh2',
          networkDriver: 'calico',
          templateVersion: '3'
        });
    });

    it('should parse a dotted template version', function() {
      expect(service.parseTemplateName('kubernetes-v1.27.4-melbourne-qh2-calico-v1.2'))
        .toEqual({
          k8sVersion: '1.27.4',
          availabilityZone: 'melbourne-qh2',
          networkDriver: 'calico',
          templateVersion: '1.2'
        });
    });

    it('should return null for names that do not follow the convention', function() {
      expect(service.parseTemplateName('swarm-v1.0-prod-docker-v1')).toBeNull();
      expect(service.parseTemplateName('random-name')).toBeNull();
      expect(service.parseTemplateName('')).toBeNull();
      // Missing the trailing -v{templateVersion} segment.
      expect(service.parseTemplateName('kubernetes-v1.0-prod-calico')).toBeNull();
    });
  });
})();
