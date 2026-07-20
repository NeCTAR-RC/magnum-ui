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
   * @name horizon.dashboard.container-infra.clusters.nodegroups.edit-labels-taints.service
   * @description Service for the "Edit Labels & Taints" modal on the cluster
   * detail page. Updates a nodegroup's Kubernetes node labels and node taints.
   */
  angular
    .module('horizon.dashboard.container-infra.clusters')
    .factory(
      'horizon.dashboard.container-infra.clusters.nodegroups.edit-labels-taints.service',
      editLabelsTaintsService);

  editLabelsTaintsService.$inject = [
    'horizon.app.core.openstack-service-api.magnum',
    'horizon.dashboard.container-infra.clusters.nodegroups.labels-taints.service',
    'horizon.framework.util.i18n.gettext',
    'horizon.framework.widgets.form.ModalFormService',
    'horizon.framework.widgets.toast.service'
  ];

  function editLabelsTaintsService(magnum, labelsTaints, gettext, modal, toast) {
    return {
      perform: perform
    };

    function perform(clusterId, nodegroup) {
      var model = {
        node_labels: labelsTaints.labelsToString(nodegroup.node_labels),
        node_taints: labelsTaints.taintsToString(nodegroup.node_taints)
      };
      var config = {
        title: interpolate(
          gettext('Edit Labels & Taints: %(name)s'),
          {name: nodegroup.name}, true),
        schema: {
          type: 'object',
          properties: {
            'node_labels': { type: 'string' },
            'node_taints': { type: 'string' }
          }
        },
        form: [
          {
            type: 'help',
            helpvalue: '<div class="alert alert-warning">' +
              gettext('Changing node labels or taints replaces every node ' +
                'in the node group with a new node (a rolling replacement). ' +
                'Workloads on the old nodes are drained and rescheduled.') +
              '</div>'
          },
          labelsTaints.labelsFormField(gettext('Comma-separated KEY=VALUE ' +
            'Kubernetes labels applied to every node in this node group. ' +
            'Replaces all existing node labels; leave empty to remove ' +
            'them all.')),
          labelsTaints.taintsFormField(gettext('Comma-separated ' +
            'KEY=VALUE:EFFECT Kubernetes taints applied to every node in ' +
            'this node group. VALUE is optional; EFFECT must be NoSchedule, ' +
            'PreferNoSchedule or NoExecute. Replaces all existing node ' +
            'taints; leave empty to remove them all.'))
        ],
        model: model
      };

      return modal.open(config).then(function() {
        return magnum.updateNodegroup(clusterId, nodegroup.id, {
          node_labels: model.node_labels,
          node_taints: model.node_taints
        }).then(function() {
          toast.add('success', gettext('Node group is being updated.'));
        });
      });
    }
  }
})();
