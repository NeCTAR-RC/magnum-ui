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

  describe('horizon.dashboard.container-infra.clusters.nodegroups.labels-taints.service',
    function() {
      var service;

      beforeEach(module('horizon.app.core'));
      beforeEach(module('horizon.framework'));
      beforeEach(module('horizon.dashboard.container-infra.clusters'));

      beforeEach(inject(function($injector) {
        service = $injector.get(
          'horizon.dashboard.container-infra.clusters.nodegroups.labels-taints.service');
      }));

      it('accepts valid and empty node label strings', function() {
        expect(service.labelsValid('')).toBe(true);
        expect(service.labelsValid(undefined)).toBe(true);
        expect(service.labelsValid('workload=gpu')).toBe(true);
        expect(service.labelsValid('a=1,b=2')).toBe(true);
        expect(service.labelsValid('empty-value=')).toBe(true);
      });

      it('rejects malformed node label strings', function() {
        expect(service.labelsValid('novalue')).toBe(false);
        expect(service.labelsValid('=noname')).toBe(false);
        expect(service.labelsValid('a=1,,b=2')).toBe(false);
        expect(service.labelsValid('a=1,novalue')).toBe(false);
      });

      it('accepts valid node taint strings', function() {
        expect(service.taintsValid('')).toBe(true);
        expect(service.taintsValid('gpu=true:NoSchedule')).toBe(true);
        expect(service.taintsValid('unreachable:NoExecute')).toBe(true);
        expect(service.taintsValid(
          'a=1:NoSchedule,b:PreferNoSchedule')).toBe(true);
      });

      it('rejects malformed node taint strings', function() {
        expect(service.taintsValid('gpu=true')).toBe(false);
        expect(service.taintsValid('gpu=true:Bogus')).toBe(false);
        expect(service.taintsValid(':NoSchedule')).toBe(false);
        expect(service.taintsValid('a=1:NoSchedule,b=2')).toBe(false);
      });

      it('formats node labels as KEY=VALUE strings', function() {
        expect(service.labelsToString({})).toBe('');
        expect(service.labelsToString(null)).toBe('');
        expect(service.labelsToString({workload: 'gpu', owner: 'ops'}))
          .toBe('workload=gpu,owner=ops');
      });

      it('formats node taints as KEY[=VALUE]:EFFECT strings', function() {
        expect(service.taintsToString([])).toBe('');
        expect(service.taintsToString(null)).toBe('');
        expect(service.taintsToString([
          {key: 'gpu', value: 'true', effect: 'NoSchedule'},
          {key: 'unreachable', value: '', effect: 'NoExecute'}
        ])).toBe('gpu=true:NoSchedule,unreachable:NoExecute');
      });

      it('builds form fields wired to the validators', function() {
        var labelsField = service.labelsFormField();
        expect(labelsField.key).toBe('node_labels');
        expect(labelsField.$validators.invalidFormat('a=1')).toBe(true);
        expect(labelsField.$validators.invalidFormat('bad')).toBe(false);

        var taintsField = service.taintsFormField('custom description');
        expect(taintsField.key).toBe('node_taints');
        expect(taintsField.description).toBe('custom description');
        expect(taintsField.$validators.invalidFormat('a:NoExecute')).toBe(true);
        expect(taintsField.$validators.invalidFormat('a:Nope')).toBe(false);
      });
    });
})();
