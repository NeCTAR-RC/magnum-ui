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
   * @name horizon.dashboard.container-infra.clusters.nodegroups.delete.service
   * @description Service for deleting a nodegroup from the cluster detail page.
   * Default nodegroups cannot be deleted.
   */
  angular
    .module('horizon.dashboard.container-infra.clusters')
    .factory('horizon.dashboard.container-infra.clusters.nodegroups.delete.service',
      deleteService);

  deleteService.$inject = [
    '$q',
    'horizon.app.core.openstack-service-api.magnum',
    'horizon.framework.util.i18n.gettext',
    'horizon.framework.widgets.modal.simple-modal.service',
    'horizon.framework.widgets.toast.service'
  ];

  function deleteService($q, magnum, gettext, simpleModal, toast) {
    return {
      perform: perform
    };

    function perform(clusterId, nodegroup) {
      if (nodegroup.is_default) {
        toast.add('error', gettext('The default node group cannot be deleted.'));
        return $q.reject();
      }

      var options = {
        title: gettext('Confirm Delete Node Group'),
        body: interpolate(
          gettext('Are you sure you want to delete node group %(name)s?'),
          {name: nodegroup.name}, true),
        submit: gettext('Delete'),
        cancel: gettext('Cancel')
      };

      return simpleModal.modal(options).result.then(function() {
        return magnum.deleteNodegroup(clusterId, nodegroup.id).then(function() {
          toast.add('success', gettext('Node group is being deleted.'));
        });
      });
    }
  }
})();
