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
