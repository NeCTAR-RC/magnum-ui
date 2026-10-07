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

  describe('horizon.dashboard.container-infra.clusters.rolling-upgrade.service', function() {

    var service, $scope, $q, deferred, magnum, spinnerModal, modalConfig;
    var selected = {
      id: 1
    };
    var modal = {
      open: function(config) {
        modalConfig = config;
        deferred = $q.defer();
        deferred.resolve(config);
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

    beforeEach(inject(function($injector, _$rootScope_, _$q_) {
      $q = _$q_;
      $scope = _$rootScope_.$new();
      service = $injector.get(
        'horizon.dashboard.container-infra.clusters.rolling-upgrade.service');
      magnum = $injector.get('horizon.app.core.openstack-service-api.magnum');
      spinnerModal = $injector.get('horizon.framework.widgets.modal-wait-spinner.service');

      spyOn(spinnerModal, 'showModalSpinner').and.callFake(function() {});
      spyOn(spinnerModal, 'hideModalSpinner').and.callFake(function() {});

      deferred = $q.defer();
      deferred.resolve({data: {uuid: 1, labels: "key1:val1,key2:val2"}});
      spyOn(magnum, 'upgradeCluster').and.returnValue(deferred.promise);

      spyOn(modal, 'open').and.callThrough();
    }));

    it('should check the policy if the user is allowed to update cluster', function() {
      var allowed = service.allowed();
      expect(allowed).toBeTruthy();
    });

    it('should open the modal, hide the loading spinner and check the form model',
      inject(function($timeout) {
        var mockClusterDetails = {
          data: {
            cluster_template_id: 'template-current'
          }
        };

        // The current cluster template lists its upgrade targets by id in the
        // `upgrade_targets` label. The Kubernetes version is encoded in the
        // template name. Templates are fetched individually by id, since the
        // current template is hidden and so absent from the template list for
        // non-admin users.
        var mockClusterTemplates = {
          'template-current': {
            id: 'template-current',
            name: 'kubernetes-v1.3.4-melbourne-qh2-calico-v1',
            hidden: true,
            labels: { upgrade_targets: 'template-new,template-newer' }
          },
          'template-new': {
            id: 'template-new',
            name: 'kubernetes-v1.4.1-melbourne-qh2-calico-v1'
          },
          'template-newer': {
            id: 'template-newer',
            name: 'kubernetes-v1.5.0-melbourne-qh2-calico-v1'
          }
        };

        deferred = $q.defer();
        deferred.resolve(mockClusterDetails);
        spyOn(magnum, 'getCluster').and.returnValue(deferred.promise);

        spyOn(magnum, 'getClusterTemplate').and.callFake(function(id) {
          return $q.when({data: mockClusterTemplates[id]});
        });

        service.perform(selected, $scope);

        $timeout(function() {
          expect(modal.open).toHaveBeenCalled();
          expect(spinnerModal.showModalSpinner).toHaveBeenCalled();
          expect(spinnerModal.hideModalSpinner).toHaveBeenCalled();

          // The current template and each listed target are fetched by id.
          expect(magnum.getClusterTemplate).toHaveBeenCalledWith('template-current');
          expect(magnum.getClusterTemplate).toHaveBeenCalledWith('template-new');
          expect(magnum.getClusterTemplate).toHaveBeenCalledWith('template-newer');
          expect(magnum.getClusterTemplate.calls.count()).toBe(3);

          // Check if the form's model skeleton is correct
          expect(modalConfig.model.id).toBe(selected.id);
          expect(modalConfig.title).toBeDefined();
          expect(modalConfig.schema).toBeDefined();
          expect(modalConfig.form).toBeDefined();

          // The two ids from `upgrade_targets` become options (plus the default
          // placeholder).
          var titleMap = modalConfig.form[0].titleMap;
          expect(titleMap.length).toBe(3);

          // Options show the Kubernetes version but submit the template id, and
          // are ordered with the newest version first.
          expect(titleMap[1].name).toBe('1.5.0');
          expect(titleMap[1].value).toBe('template-newer');
          expect(titleMap[2].name).toBe('1.4.1');
          expect(titleMap[2].value).toBe('template-new');

          // The Kubernetes version select is the only field; there is no
          // batch size field.
          expect(modalConfig.form.length).toBe(1);
          expect(modalConfig.schema.properties.max_batch_size).toBeUndefined();

          // The batch size is silently submitted as 1.
          expect(magnum.upgradeCluster).toHaveBeenCalledWith(selected.id, jasmine.objectContaining({
            max_batch_size: 1
          }));
        }, 0);

        $timeout.flush();
        $scope.$apply();
      }));

    it('should mark the cluster as on the latest version when upgrade_targets is empty',
      inject(function($timeout) {
        var mockClusterDetails = {
          data: {
            cluster_template_id: 'template-current'
          }
        };

        var mockClusterTemplate = {
          data: {
            id: 'template-current',
            name: 'kubernetes-v1.4.1-melbourne-qh2-calico-v1',
            labels: { upgrade_targets: '' }
          }
        };

        deferred = $q.defer();
        deferred.resolve(mockClusterDetails);
        spyOn(magnum, 'getCluster').and.returnValue(deferred.promise);

        deferred = $q.defer();
        deferred.resolve(mockClusterTemplate);
        spyOn(magnum, 'getClusterTemplate').and.returnValue(deferred.promise);

        service.perform(selected, $scope);

        $timeout(function() {
          // Only the current template is fetched; there are no targets to look up.
          expect(magnum.getClusterTemplate.calls.count()).toBe(1);

          // Only the placeholder option remains and the select is read only.
          expect(modalConfig.form[0].titleMap.length).toBe(1);
          expect(modalConfig.form[0].readonly).toBe(true);
        }, 0);

        $timeout.flush();
        $scope.$apply();
      }));

    it('should skip upgrade targets that cannot be retrieved',
      inject(function($timeout) {
        var mockClusterDetails = {
          data: {
            cluster_template_id: 'template-current'
          }
        };

        var mockClusterTemplates = {
          'template-current': {
            id: 'template-current',
            name: 'kubernetes-v1.3.4-melbourne-qh2-calico-v1',
            labels: { upgrade_targets: 'template-missing,template-new' }
          },
          'template-new': {
            id: 'template-new',
            name: 'kubernetes-v1.4.1-melbourne-qh2-calico-v1'
          }
        };

        deferred = $q.defer();
        deferred.resolve(mockClusterDetails);
        spyOn(magnum, 'getCluster').and.returnValue(deferred.promise);

        // The API service swallows request errors and resolves to undefined.
        spyOn(magnum, 'getClusterTemplate').and.callFake(function(id) {
          return $q.when(mockClusterTemplates[id] ? {data: mockClusterTemplates[id]} : undefined);
        });

        service.perform(selected, $scope);

        $timeout(function() {
          expect(modal.open).toHaveBeenCalled();

          // The missing target is dropped; the remaining one is still offered.
          var titleMap = modalConfig.form[0].titleMap;
          expect(titleMap.length).toBe(2);
          expect(titleMap[1].value).toBe('template-new');
          expect(modalConfig.form[0].readonly).toBe(false);
        }, 0);

        $timeout.flush();
        $scope.$apply();
      }));

    it('should not open the modal when the current template cannot be retrieved',
      inject(function($timeout) {
        var mockClusterDetails = {
          data: {
            cluster_template_id: 'template-current'
          }
        };

        deferred = $q.defer();
        deferred.resolve(mockClusterDetails);
        spyOn(magnum, 'getCluster').and.returnValue(deferred.promise);

        // The API service swallows request errors and resolves to undefined.
        spyOn(magnum, 'getClusterTemplate').and.returnValue($q.when(undefined));

        service.perform(selected, $scope);

        $timeout(function() {
          expect(modal.open).not.toHaveBeenCalled();
          expect(spinnerModal.hideModalSpinner).toHaveBeenCalled();
        }, 0);

        $timeout.flush();
        $scope.$apply();
      }));

    it('should not open the modal due to a request error and should hide the loading spinner',
      inject(function($timeout) {
        deferred = $q.defer();
        deferred.reject();
        spyOn(magnum, 'getCluster').and.returnValue(deferred.promise);
        spyOn(magnum, 'getClusterTemplate').and.returnValue(deferred.promise);

        service.perform(selected, $scope);

        $timeout(function() {
          expect(modal.open).not.toHaveBeenCalled();
          expect(spinnerModal.showModalSpinner).toHaveBeenCalled();
          expect(spinnerModal.hideModalSpinner).toHaveBeenCalled();
        }, 0);

        $timeout.flush();
        $scope.$apply();
      }));

  });
})();
