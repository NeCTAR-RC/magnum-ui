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
   * @name horizon.dashboard.container-infra.clusters.nodegroups.manage.service
   * @description
   * Cluster list item action that takes the user straight to the "Node Groups"
   * tab of the cluster detail page. It just navigates to the cluster's detail
   * route with a ?tab=nodegroups marker; ClusterNodegroupsController reads that
   * marker and activates the tab.
   */
  angular
    .module('horizon.dashboard.container-infra.clusters')
    .factory(
      'horizon.dashboard.container-infra.clusters.nodegroups.manage.service',
      manageNodegroupsService);

  manageNodegroupsService.$inject = [
    '$location',
    'horizon.app.core.detailRoute',
    'horizon.dashboard.container-infra.clusters.resourceType',
    'horizon.framework.util.q.extensions'
  ];

  function manageNodegroupsService($location, detailRoute, resourceType, $qExtensions) {
    var service = {
      initAction: initAction,
      perform: perform,
      allowed: allowed
    };

    return service;

    //////////////

    function initAction() {
    }

    // Navigate to the cluster detail page, flagging the Node Groups tab so the
    // detail view opens on it (see ClusterNodegroupsController). This mirrors
    // the cluster name link (clustersService.urlFunction) plus the tab marker.
    function perform(cluster) {
      $location
        .path('/' + detailRoute + resourceType + '/' + cluster.id)
        .search('tab', 'nodegroups');
    }

    // Viewing/managing node groups is available regardless of cluster state;
    // the individual node group actions are gated on the detail page itself.
    function allowed() {
      return $qExtensions.booleanAsPromise(true);
    }
  }
})();
