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

  /**
   * @ngdoc overview
   * @name horizon.dashboard.container-infra.clusters.nodegroups.create.service
   * @description Service for the "Create Node Group" modal on the cluster
   * detail page. Creates a worker nodegroup, optionally with autoscaling.
   */
  angular
    .module('horizon.dashboard.container-infra.clusters')
    .factory('horizon.dashboard.container-infra.clusters.nodegroups.create.service',
      createService);

  createService.$inject = [
    '$q',
    'horizon.app.core.openstack-service-api.magnum',
    'horizon.app.core.openstack-service-api.nova',
    'horizon.framework.util.i18n.gettext',
    'horizon.framework.widgets.form.ModalFormService',
    'horizon.framework.widgets.toast.service',
    'horizon.framework.widgets.modal-wait-spinner.service'
  ];

  function createService($q, magnum, nova, gettext, modal, toast, spinnerModal) {
    return {
      perform: perform
    };

    // The cluster's nodegroup tab calls perform(clusterId). The returned promise
    // resolves once the nodegroup is created so the tab can reload its list.
    function perform(clusterId) {
      var deferred = $q.defer();
      spinnerModal.showModalSpinner(gettext('Loading'));

      nova.getFlavors(false, false).then(onLoad).catch(hideSpinnerOnError);

      function onLoad(response) {
        var flavorTitleMap = [{value: '', name: gettext('Choose a Flavor')}];
        angular.forEach(response.data.items, function(flavor) {
          flavorTitleMap.push({value: flavor.name, name: flavor.name});
        });

        var model = {
          name: '',
          flavor_id: '',
          node_count: 1,
          auto_scaling_enabled: false,
          min_node_count: 1,
          max_node_count: 1,
          boot_from_volume: false,
          boot_volume_size: null,
          boot_volume_type: ''
        };

        var config = {
          title: gettext('Create Node Group'),
          schema: {
            type: 'object',
            properties: {
              'name': { type: 'string', minLength: 1 },
              'flavor_id': { type: 'string' },
              'node_count': { type: 'number', minimum: 1 },
              'auto_scaling_enabled': { type: 'boolean' },
              'min_node_count': { type: 'number', minimum: 1 },
              'max_node_count': { type: 'number', minimum: 1 },
              'boot_from_volume': { type: 'boolean' },
              'boot_volume_size': { type: 'number', minimum: 1 },
              'boot_volume_type': { type: 'string' }
            }
          },
          form: [
            {
              type: 'tabs',
              tabs: [
                {
                  title: gettext('Details'),
                  type: 'section',
                  htmlClass: 'row',
                  required: true,
                  items: [
                    {
                      type: 'section',
                      htmlClass: 'col-md-12',
                      items: [
                        { key: 'name', title: gettext('Name'), required: true },
                        {
                          key: 'flavor_id',
                          type: 'select',
                          title: gettext('Flavor'),
                          titleMap: flavorTitleMap,
                          required: true
                        },
                        {
                          key: 'node_count',
                          title: gettext('Node Count'),
                          required: true,
                          validationMessage: {
                            outOfRange: gettext('Node count must be between the ' +
                              'minimum and maximum node count.')
                          },
                          $validators: {
                            outOfRange: function(value) {
                              return !model.auto_scaling_enabled ||
                                value >= model.min_node_count &&
                                value <= model.max_node_count;
                            }
                          }
                        }
                      ]
                    }
                  ]
                },
                {
                  title: gettext('Advanced'),
                  type: 'section',
                  htmlClass: 'row',
                  items: [
                    {
                      type: 'section',
                      htmlClass: 'col-md-12',
                      items: [
                        {
                          key: 'auto_scaling_enabled',
                          type: 'checkbox',
                          title: gettext('Enable Autoscaling')
                        },
                        {
                          key: 'min_node_count',
                          title: gettext('Minimum Node Count'),
                          condition: 'model.auto_scaling_enabled == true',
                          required: true
                        },
                        {
                          key: 'max_node_count',
                          title: gettext('Maximum Node Count'),
                          condition: 'model.auto_scaling_enabled == true',
                          required: true,
                          validationMessage: {
                            maxLtMin: gettext('Maximum must be greater than or ' +
                              'equal to minimum.')
                          },
                          $validators: {
                            maxLtMin: function(value) {
                              return value >= model.min_node_count;
                            }
                          }
                        },
                        {
                          key: 'boot_from_volume',
                          type: 'checkbox',
                          title: gettext('Boot from volume')
                        },
                        {
                          key: 'boot_volume_size',
                          title: gettext('Boot Volume Size (GB)'),
                          placeholder: gettext('Size of the boot volume in GB'),
                          condition: 'model.boot_from_volume == true',
                          required: true
                        },
                        {
                          key: 'boot_volume_type',
                          title: gettext('Boot Volume Type'),
                          placeholder: gettext('Cinder volume type for the boot volume'),
                          description: gettext('Optional. If left blank, the standard ' +
                            'volume type is used.'),
                          condition: 'model.boot_from_volume == true'
                        }
                      ]
                    }
                  ]
                }
              ]
            }
          ],
          model: model
        };

        deferred.resolve(modal.open(config).then(function() {
          return onSubmit(clusterId, model);
        }));
        spinnerModal.hideModalSpinner();
      }

      function hideSpinnerOnError(error) {
        spinnerModal.hideModalSpinner();
        deferred.promise.catch(angular.noop);
        return deferred.reject(error);
      }

      return deferred.promise;
    }

    function onSubmit(clusterId, model) {
      var params = {
        name: model.name,
        flavor_id: model.flavor_id,
        node_count: model.node_count,
        role: 'worker'
      };
      if (model.auto_scaling_enabled) {
        params.min_node_count = model.min_node_count;
        params.max_node_count = model.max_node_count;
      }
      // Boot from volume is expressed via Magnum labels; the volume type is
      // optional and, when left blank, the standard volume type is used.
      if (model.boot_from_volume) {
        params.labels = {boot_volume_size: model.boot_volume_size};
        if (model.boot_volume_type) {
          params.labels.boot_volume_type = model.boot_volume_type;
        }
      }
      return magnum.createNodegroup(clusterId, params).then(function() {
        toast.add('success', gettext('Node group is being created.'));
      });
    }
  }
})();
