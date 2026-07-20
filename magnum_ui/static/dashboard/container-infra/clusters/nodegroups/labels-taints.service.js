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
   * @ngdoc service
   * @name horizon.dashboard.container-infra.clusters.nodegroups.labels-taints.service
   * @description Shared helpers for the Kubernetes node label and node taint
   * fields on the nodegroup create and edit modals. Labels are entered as
   * comma-separated KEY=VALUE pairs and taints as KEY[=VALUE]:EFFECT entries,
   * mirroring the CLI flags; the strings are parsed server-side.
   */
  angular
    .module('horizon.dashboard.container-infra.clusters')
    .factory(
      'horizon.dashboard.container-infra.clusters.nodegroups.labels-taints.service',
      labelsTaintsService);

  labelsTaintsService.$inject = [
    'horizon.framework.util.i18n.gettext'
  ];

  function labelsTaintsService(gettext) {
    var LABELS_RE = /^[^,=:\s]+=[^,=:\s]*(,[^,=:\s]+=[^,=:\s]*)*$/;
    var TAINTS_RE = new RegExp(
      '^[^,=:\\s]+(=[^,=:\\s]*)?:(NoSchedule|PreferNoSchedule|NoExecute)' +
      '(,[^,=:\\s]+(=[^,=:\\s]*)?:(NoSchedule|PreferNoSchedule|NoExecute))*$');

    return {
      labelsValid: labelsValid,
      taintsValid: taintsValid,
      labelsToString: labelsToString,
      taintsToString: taintsToString,
      labelsFormField: labelsFormField,
      taintsFormField: taintsFormField
    };

    // Empty is always valid: both fields are optional and an empty value
    // clears the field on update.
    function labelsValid(value) {
      return !value || LABELS_RE.test(value);
    }

    function taintsValid(value) {
      return !value || TAINTS_RE.test(value);
    }

    // Format a node_labels dict in the KEY=VALUE,... form the fields accept.
    function labelsToString(labels) {
      return Object.keys(labels || {}).map(function(key) {
        return key + '=' + labels[key];
      }).join(',');
    }

    // Format a node_taints list in the KEY[=VALUE]:EFFECT,... form.
    function taintsToString(taints) {
      return (taints || []).map(function(taint) {
        return taint.key + (taint.value ? '=' + taint.value : '') +
          ':' + taint.effect;
      }).join(',');
    }

    function labelsFormField(description) {
      return {
        key: 'node_labels',
        title: gettext('Kubernetes Node Labels'),
        placeholder: 'key1=value1,key2=value2',
        description: description || gettext('Optional. Comma-separated ' +
          'KEY=VALUE Kubernetes labels to apply to every node in this ' +
          'node group.'),
        validationMessage: {
          invalidFormat: gettext(
            'Node labels must be comma-separated KEY=VALUE pairs.')
        },
        $validators: {
          invalidFormat: labelsValid
        }
      };
    }

    function taintsFormField(description) {
      return {
        key: 'node_taints',
        title: gettext('Kubernetes Node Taints'),
        placeholder: 'key1=value1:NoSchedule,key2:NoExecute',
        description: description || gettext('Optional. Comma-separated ' +
          'KEY=VALUE:EFFECT Kubernetes taints to apply to every node in ' +
          'this node group. VALUE is optional; EFFECT must be NoSchedule, ' +
          'PreferNoSchedule or NoExecute.'),
        validationMessage: {
          invalidFormat: gettext(
            'Node taints must be comma-separated KEY=VALUE:EFFECT entries ' +
            'with an effect of NoSchedule, PreferNoSchedule or NoExecute.')
        },
        $validators: {
          invalidFormat: taintsValid
        }
      };
    }
  }
})();
