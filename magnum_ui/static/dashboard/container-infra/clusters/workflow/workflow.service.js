/**
 * Copyright 2015 Cisco Systems, Inc.
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

  /**
   * @ngdoc overview
   * @name horizon.dashboard.container-infra.clusters.workflow
   * @ngModule
   *
   * @description
   * Provides business logic for Cluster creation workflow, including data model,
   * UI form schema and configuration, fetching and processing of required data.
   */
  angular
    .module('horizon.dashboard.container-infra.clusters')
    .factory(
      'horizon.dashboard.container-infra.clusters.workflow',
      ClusterWorkflow);

  ClusterWorkflow.$inject = [
    '$q',
    'horizon.dashboard.container-infra.basePath',
    'horizon.framework.util.i18n.gettext',
    'horizon.app.core.openstack-service-api.magnum',
    'horizon.app.core.openstack-service-api.nova',
    'horizon.dashboard.container-infra.utils.service'
  ];

  // Object name, must start with alphabetical character.
  var REGEXP_CLUSTER_NAME = /^[a-zA-Z][a-zA-Z0-9_\-\.]*$/;

  function ClusterWorkflow($q, basePath, gettext, magnum, nova, utils) {
    var workflow = {
      init: init
    };

    function init(title, $scope) {
      var schema, form;

      // Default <option>s; will be shown in selector as a placeholder.
      // These three selectors cascade to derive a (hidden) cluster template.
      var k8sVersionPlaceholder = gettext('Choose a Kubernetes Version');
      var availabilityZonePlaceholder = gettext('Choose an Availability Zone');
      var networkDriverPlaceholder = gettext('Choose a Network Driver');
      var k8sVersionTitleMap = [{value: '', name: k8sVersionPlaceholder}];
      var availabilityZoneTitleMap = [{value: '', name: availabilityZonePlaceholder}];
      var networkDriverTitleMap = [{value: '', name: networkDriverPlaceholder}];
      var masterFlavorTitleMap = [{value: '',
        name: gettext('Choose a Flavor for the Control Plane nodes')}];
      var workerFlavorTitleMap = [{value: '',
        name: gettext('Choose a Flavor for the Worker nodes')}];
      var ingressTitleMap = [{value: '', name: gettext('Choose an ingress controller')}];

      var addonsTitleMap = [];

      var MODEL_DEFAULTS = getModelDefaults();
      var model = getModelDefaults();

      // Parsed + filtered cluster templates, indexed for the cascade/derivation.
      var parsedTemplates = [];

      schema = {
        type: 'object',
        properties: {
          'name': { type: 'string' },
          'cluster_template_id': { type: 'string' },
          'k8s_version': { type: 'string' },
          'availability_zone': { type: 'string' },
          'network_driver': { type: 'string' },
          'addons': {
            type: 'array',
            items: { type: 'object' },
            minItems: 0
          },

          'master_count': {
            type: 'number',
            minimum: 1,
            maximum: 7,
          },
          'master_flavor_id': { type: 'string' },
          'node_count': {
            type: 'number',
            minimum: 0
          },
          'flavor_id': { type: 'string' },
          'auto_scaling_enabled': { type: 'boolean' },
          'min_node_count': {
            type: 'number',
            minimum: 0
          },
          'max_node_count': { type: 'number' },

          'master_lb_enabled': { type: 'boolean' },
          'create_network': { type: 'boolean' },
          'fixed_network': { type: 'string' },
          'fixed_subnet': { type: 'string' },
          'master_lb_floating_ip_enabled': { type: 'boolean' },
          'api_master_lb_allowed_cidrs': { type: 'string' },
          'ingress_controller': { type: 'object' },

          'auto_healing_enabled': { type: 'boolean' },

          'etcd_separate_volume': { type: 'boolean' },
          'etcd_volume_size': {
            type: 'number',
            minimum: 1
          },
          'etcd_blockdevice_volume_type': { type: 'string' }
        }
      };

      var formMasterCount = {
        key: 'master_count',
        title: gettext('Number of Control Plane nodes'),
        placeholder: gettext('The number of Control Plane nodes for the cluster'),
        required: true,
        validationMessage: {
          'mustBeUnevenNumber': 'Supported control plane sizes are 1, 3, 5 or 7.'
        },
        $validators: {
          mustBeUnevenNumber: function(value) {
            return value % 2 !== 0;
          }
        }
      };

      // Disable the Master Count field, if only a single master is allowed
      var isSingleMasterNodeWatcher = $scope.$watch(
        function() { return model.isSingleMasterNode; },
        function(isSingle) {
          if (typeof isSingle !== 'undefined') {
            formMasterCount.readonly = isSingle;
          }
        },
        true);

      // Cascading selectors that together derive the (hidden) cluster template.
      // References are held so their `titleMap` can be rebuilt in place by the
      // onChange handlers, without relying on brittle form[] index chains.
      var k8sVersionField = {
        key: 'k8s_version',
        type: 'select',
        title: gettext('Kubernetes Version'),
        titleMap: k8sVersionTitleMap,
        required: true,
        onChange: function() { changeK8sVersion(); }
      };
      var availabilityZoneField = {
        key: 'availability_zone',
        type: 'select',
        title: gettext('Availability Zone'),
        titleMap: availabilityZoneTitleMap,
        required: true,
        onChange: function() { changeAvailabilityZone(); }
      };
      var networkDriverField = {
        key: 'network_driver',
        type: 'select',
        title: gettext('Network Driver'),
        titleMap: networkDriverTitleMap,
        required: true,
        onChange: function() { changeNetworkDriver(); }
      };

      form = [
        {
          type:'tabs',
          tabs: [
            {
              title: gettext('Details'),
              help: basePath + 'clusters/workflow/details.help.html',
              type: 'section',
              htmlClass: 'row',
              required: true,
              items: [
                {
                  type: 'section',
                  htmlClass: 'col-md-8',
                  items: [
                    {
                      key: 'name',
                      title: gettext('Cluster Name'),
                      placeholder: gettext('Name of the cluster'),
                      required: true,
                      help: "Text",
                      validationMessage: {
                        'invalidFormat': 'Cluster name must begin with an alphabetical ' +
                                         'character and only contain alphanumeric, underscore, ' +
                                         'dash and fullstop characters.'
                      },
                      $validators: {
                        invalidFormat: function(value) {
                          return REGEXP_CLUSTER_NAME.test(value);
                        }
                      }
                    },
                    k8sVersionField,
                    availabilityZoneField,
                    networkDriverField,
                    // Summary of the derived cluster configuration
                    {
                      type: 'template',
                      templateUrl: basePath + 'clusters/workflow/cluster-template.html'
                    }
                  ]
                }
              ]
            },
            {
              title: gettext('Size'),
              help: basePath + 'clusters/workflow/size.help.html',
              type: 'section',
              htmlClass: 'row',
              required: true,
              items: [
                {
                  type: 'section',
                  htmlClass: 'col-md-8',
                  items: [
                    {
                      type: 'fieldset',
                      title: gettext('Control Plane Nodes'),
                      items: [
                        formMasterCount,
                        // Info message explaining why only single master node is enabled
                        {
                          type: 'template',
                          template: '<div class="alert alert-info">' +
                            '<span class="fa fa-info-circle"></span> ' +
                            gettext('The selected options do not support ' +
                            'multiple control plane nodes. A Kubernetes ' +
                            'API Load Balancer is required, and can be ' +
                            'enabled in the Network tab.') +
                            '</div>',
                          condition: 'model.isSingleMasterNode == true'
                        },
                        // Info message explaining why we allow only uneven numbers of
                        // control plane nodes.
                        {
                          type: 'template',
                          template: '<div class="alert alert-info">' +
                            '<span class="fa fa-info-circle"></span> ' +
                            gettext('Only an uneven number of control plane nodes are allowed. ' +
                              'This provides the best balance of fault tolerance and cost.') +
                            '</div>',
                          condition: 'false'
                        },
                        {
                          key: 'master_flavor_id',
                          title: gettext('Flavor of Control Plane Nodes'),
                          type: 'select',
                          titleMap: masterFlavorTitleMap,
                          required: true
                        }
                      ]
                    },
                    {
                      type: 'fieldset',
                      title: gettext('Worker Nodes'),
                      items: [
                        {
                          key: 'node_count',
                          title: gettext('Number of Worker Nodes'),
                          placeholder: gettext('The number of worker nodes for the cluster'),
                          required: true,
                          onChange: autosetScalingModelValues
                        },
                        {
                          key: 'flavor_id',
                          title: gettext('Flavor of Worker Nodes'),
                          type: 'select',
                          titleMap: workerFlavorTitleMap,
                          required: true
                        }
                      ]
                    }
                  ]
                }
              ]
            },
            {
              title: gettext('Advanced'),
              help: basePath + 'clusters/workflow/advanced.help.html',
              type: 'section',
              htmlClass: 'row',
              items: [
                {
                  type: 'section',
                  htmlClass: 'col-md-8',
                  items: [
                    {
                      type: 'fieldset',
                      title: gettext('etcd Storage'),
                      items: [
                        {
                          key: 'etcd_separate_volume',
                          type: 'checkbox',
                          title: gettext('Store etcd on a separate volume')
                        },
                        {
                          key: 'etcd_volume_size',
                          title: gettext('etcd Volume Size (GB)'),
                          placeholder: gettext('Size of the etcd volume in GB'),
                          condition: 'model.etcd_separate_volume == true',
                          required: true
                        },
                        {
                          key: 'etcd_blockdevice_volume_type',
                          title: gettext('etcd Volume Type'),
                          placeholder: gettext('Cinder volume type for the etcd volume'),
                          description: gettext('Optional. If left blank, the standard ' +
                            'volume type is used.'),
                          condition: 'model.etcd_separate_volume == true'
                        }
                      ]
                    }
                  ]
                }
              ]
            }
          ]
        }
      ];

      function getModelDefaults() {
        return {
          // Props used by the form
          name: '',
          cluster_template_id: '',
          k8s_version: '',
          availability_zone: '',
          network_driver: '',
          addons: [],

          master_count: null,
          master_flavor_id: '',
          node_count: null,
          flavor_id: '',
          auto_scaling_enabled: false,
          min_node_count: null,
          max_node_count: null,

          master_lb_enabled: true,
          create_network: true,
          fixed_network: '',
          fixed_subnet: '',
          master_lb_floating_ip_enabled: false,
          api_master_lb_allowed_cidrs: '',
          ingress_controller: '',

          auto_healing_enabled: true,
          etcd_separate_volume: false,
          etcd_volume_size: null,
          etcd_blockdevice_volume_type: '',

          // Utility properties (not actively used in the form,
          // populated dynamically)
          id: null,
          templateLabels: null,
          ingressControllers: null,
          isSingleMasterNode: false
        };
      }

      function autosetScalingModelValues() {
        var nodeCount = model.node_count;
        if (nodeCount && nodeCount > 0 && model.auto_scaling_enabled) {

          // Set defaults to related modal fields (have they not been changed)
          if (model.min_node_count === MODEL_DEFAULTS.min_node_count) {
            model.min_node_count = nodeCount > 1 ? nodeCount - 1 : 1;
          } else if (nodeCount < model.min_node_count) {
            model.min_node_count = nodeCount;
          }

          if (model.max_node_count === MODEL_DEFAULTS.max_node_count) {
            model.max_node_count = nodeCount + 1;
          } else if (nodeCount > model.max_node_count) {
            model.max_node_count = nodeCount;
          }
        }
      }

      function onGetAddons(response) {
        angular.forEach(response.data.addons, function(addon) {
          addonsTitleMap.push({ value: addon, name: addon.name });
          // Pre-selected by default
          if (addon.selected) { model.addons.push(addon); }
        });
      }

      function onGetFlavors(response) {
        angular.forEach(response.data.items, function(flavor) {
          workerFlavorTitleMap.push({value: flavor.name, name: flavor.name});
          masterFlavorTitleMap.push({value: flavor.name, name: flavor.name});
        });
      }

      // Parse the template names, keep only conforming (kubernetes) templates, and
      // seed the top of the cascade. The user never sees the templates themselves.
      function onGetClusterTemplates(response) {
        angular.forEach(response.data.items, function(clusterTemplate) {
          var parsed = utils.parseTemplateName(clusterTemplate.name);
          if (!parsed) { return; }
          parsedTemplates.push({
            id: clusterTemplate.id,
            name: clusterTemplate.name,
            k8sVersion: parsed.k8sVersion,
            availabilityZone: parsed.availabilityZone,
            // Prefer the template's real network_driver; the parsed value is only
            // positionally correct when the driver contains no dashes.
            networkDriver: clusterTemplate.network_driver || parsed.networkDriver,
            templateVersion: parsed.templateVersion
          });
        });
        rebuildK8sVersionOptions();
      }

      // Rebuild a titleMap in place (keeping its array reference, which the rendered
      // <select> watches) from a placeholder and a list of values.
      function setTitleMapOptions(titleMap, placeholder, values) {
        titleMap.length = 0;
        titleMap.push({value: '', name: placeholder});
        values.forEach(function(value) {
          titleMap.push({value: value, name: value});
        });
      }

      function distinctValues(list) {
        var seen = {};
        var result = [];
        list.forEach(function(value) {
          if (!Object.prototype.hasOwnProperty.call(seen, value)) {
            seen[value] = true;
            result.push(value);
          }
        });
        return result;
      }

      function compareStrings(first, second) {
        return first.localeCompare(second);
      }

      // Top of the cascade: distinct k8s versions, newest first.
      function rebuildK8sVersionOptions() {
        var versions = distinctValues(parsedTemplates.map(function(template) {
          return template.k8sVersion;
        }));
        versions.sort(function(first, second) {
          return utils.versionCompare(second, first);
        });
        setTitleMapOptions(k8sVersionTitleMap, k8sVersionPlaceholder, versions);
        if (versions.length === 1) {
          model.k8s_version = versions[0];
          changeK8sVersion();
        }
      }

      // k8s version chosen -> narrow availability zones, reset lower selections.
      function changeK8sVersion() {
        var zones = distinctValues(parsedTemplates.filter(function(template) {
          return template.k8sVersion === model.k8s_version;
        }).map(function(template) {
          return template.availabilityZone;
        }));
        zones.sort(compareStrings);
        setTitleMapOptions(availabilityZoneTitleMap, availabilityZonePlaceholder, zones);
        setTitleMapOptions(networkDriverTitleMap, networkDriverPlaceholder, []);
        model.availability_zone = MODEL_DEFAULTS.availability_zone;
        model.network_driver = MODEL_DEFAULTS.network_driver;
        model.cluster_template_id = MODEL_DEFAULTS.cluster_template_id;
        if (zones.length === 1) {
          model.availability_zone = zones[0];
          changeAvailabilityZone();
        }
      }

      // Availability zone chosen -> narrow network drivers, reset lower selections.
      function changeAvailabilityZone() {
        var drivers = distinctValues(parsedTemplates.filter(function(template) {
          return template.k8sVersion === model.k8s_version &&
            template.availabilityZone === model.availability_zone;
        }).map(function(template) {
          return template.networkDriver;
        }));
        drivers.sort(compareStrings);
        setTitleMapOptions(networkDriverTitleMap, networkDriverPlaceholder, drivers);
        model.network_driver = MODEL_DEFAULTS.network_driver;
        model.cluster_template_id = MODEL_DEFAULTS.cluster_template_id;
        if (drivers.length === 1) {
          model.network_driver = drivers[0];
          changeNetworkDriver();
        }
      }

      // Network driver chosen -> derive the matching cluster template.
      function changeNetworkDriver() {
        deriveClusterTemplate();
      }

      // Find the template matching all three selections, preferring the highest
      // template version. Setting cluster_template_id triggers the
      // clusterTemplateController watcher, which populates the remaining defaults.
      function deriveClusterTemplate() {
        var matches = parsedTemplates.filter(function(template) {
          return template.k8sVersion === model.k8s_version &&
            template.availabilityZone === model.availability_zone &&
            template.networkDriver === model.network_driver;
        });
        if (!matches.length) {
          model.cluster_template_id = MODEL_DEFAULTS.cluster_template_id;
          return;
        }
        matches.sort(function(first, second) {
          var compared = utils.versionCompare(second.templateVersion, first.templateVersion);
          return isNaN(compared)
            ? second.templateVersion.localeCompare(first.templateVersion)
            : compared;
        });
        model.cluster_template_id = matches[0].id;
      }

      function onGetIngressControllers(response) {
        angular.forEach(response.data.controllers, function(ingressController) {
          ingressTitleMap.push({value: ingressController, name: ingressController.name});
        });

        model.ingressControllers = response.data.controllers;

        // Set first item to defaults
        if (model.ingressControllers.length > 0) {
          model.ingress_controller = ingressTitleMap[1].value;
        }
      }

      $scope.$on('$destroy', function() {
        isSingleMasterNodeWatcher();
      });

      // Fetch all the dependencies from APIs and return Promise
      // with a form configuration object.
      return $q.all([
        magnum.getClusterTemplates().then(onGetClusterTemplates),
        magnum.getAddons().then(onGetAddons),
        nova.getFlavors(false, false).then(onGetFlavors),
        magnum.getIngressControllers().then(onGetIngressControllers)
      ]).then(function() {
        $scope.model = model;
        $scope.model.DEFAULTS = MODEL_DEFAULTS;

        // Modal Config
        return {
          title: title,
          schema: schema,
          form: form,
          model: model
        };
      });
    }

    return workflow;
  }

})();
