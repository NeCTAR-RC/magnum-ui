# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#    http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.

from unittest import mock

from magnum_ui.api import magnum
from openstack_dashboard.test import helpers as test


class MagnumApiTestCase(test.TestCase):

    @mock.patch.object(magnum, 'magnumclient')
    def test_cluster_create_forwards_only_etcd_labels(self, mock_magnumclient):
        create = mock_magnumclient.return_value.clusters.create

        magnum.cluster_create(
            mock.Mock(),
            name='cluster1',
            cluster_template_id='ct1',
            rollback=False,
            labels={
                'etcd_volume_size': 20,
                'etcd_blockdevice_volume_type': 'b1.standard',
                # Other create-form labels must NOT be forwarded; they come
                # from the cluster template.
                'auto_healing_enabled': True,
                'kube_tag': 'v1.27.4',
            },
        )

        create.assert_called_once()
        sent = create.call_args.kwargs
        # Label values are coerced to strings and limited to the etcd labels.
        self.assertEqual(sent['labels'], {
            'etcd_volume_size': '20',
            'etcd_blockdevice_volume_type': 'b1.standard',
        })
        # Merged over the template's labels so template labels are preserved.
        self.assertTrue(sent['merge_labels'])

    @mock.patch.object(magnum, 'magnumclient')
    def test_cluster_create_drops_non_etcd_labels(self, mock_magnumclient):
        create = mock_magnumclient.return_value.clusters.create

        magnum.cluster_create(
            mock.Mock(),
            name='cluster1',
            cluster_template_id='ct1',
            rollback=False,
            labels={'auto_healing_enabled': True, 'kube_tag': 'v1.27.4'},
        )

        create.assert_called_once()
        sent = create.call_args.kwargs
        self.assertNotIn('labels', sent)
        self.assertNotIn('merge_labels', sent)

    @mock.patch.object(magnum, 'magnumclient')
    def test_nodegroup_create_defaults_role_and_omits_labels(
            self, mock_magnumclient):
        create = mock_magnumclient.return_value.nodegroups.create

        magnum.nodegroup_create(
            mock.Mock(), 'c1', name='ng1', flavor_id='m1.small', node_count=2)

        create.assert_called_once()
        self.assertEqual(create.call_args.args[0], 'c1')
        sent = create.call_args.kwargs
        self.assertEqual(sent['role'], 'worker')
        self.assertNotIn('labels', sent)
        self.assertNotIn('merge_labels', sent)

    @mock.patch.object(magnum, 'magnumclient')
    def test_nodegroup_create_merges_labels(self, mock_magnumclient):
        create = mock_magnumclient.return_value.nodegroups.create

        magnum.nodegroup_create(
            mock.Mock(), 'c1', name='ng1', flavor_id='m1.small',
            node_count=2, labels={'k': 'v'})

        sent = create.call_args.kwargs
        self.assertEqual(sent['labels'], {'k': 'v'})
        self.assertTrue(sent['merge_labels'])

    @mock.patch.object(magnum, 'magnumclient')
    def test_nodegroup_update_patches_only_minmax(self, mock_magnumclient):
        nodegroups = mock_magnumclient.return_value.nodegroups
        nodegroups.get.return_value.to_dict.return_value = {
            'name': 'ng1', 'flavor_id': 'm1.small', 'node_count': 2,
            'role': 'worker', 'min_node_count': 1, 'max_node_count': 3,
        }

        magnum.nodegroup_update(
            mock.Mock(), 'c1', 'ng-id', min_node_count=2, max_node_count=6)

        nodegroups.update.assert_called_once()
        cluster_id, nodegroup_id, patch = nodegroups.update.call_args.args
        self.assertEqual(cluster_id, 'c1')
        self.assertEqual(nodegroup_id, 'ng-id')
        self.assertEqual(
            sorted(op['path'] for op in patch),
            ['/max_node_count', '/min_node_count'])
        # Magnum requires the node counts as integers, not strings.
        values = {op['path']: op['value'] for op in patch}
        self.assertEqual(values['/min_node_count'], 2)
        self.assertEqual(values['/max_node_count'], 6)
        for op in patch:
            self.assertIsInstance(op['value'], int)
