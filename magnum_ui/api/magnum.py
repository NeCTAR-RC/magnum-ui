#  Copyright 2015 Cisco Systems.
#
#    Licensed under the Apache License, Version 2.0 (the "License"); you may
#    not use this file except in compliance with the License. You may obtain
#    a copy of the License at
#
#         http://www.apache.org/licenses/LICENSE-2.0
#
#    Unless required by applicable law or agreed to in writing, software
#    distributed under the License is distributed on an "AS IS" BASIS, WITHOUT
#    WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the
#    License for the specific language governing permissions and limitations
#    under the License.


from __future__ import absolute_import
import logging

from django.conf import settings

from horizon import exceptions
from horizon.utils.memoized import memoized
from openstack_dashboard.api import base

from magnumclient.v1 import certificates
from magnumclient.v1 import client as magnum_client
from magnumclient.v1 import cluster_templates
from magnumclient.v1 import clusters
from magnumclient.v1 import quotas

LOG = logging.getLogger(__name__)

CLUSTER_TEMPLATE_CREATE_ATTRS = cluster_templates.CREATION_ATTRIBUTES
CLUSTER_CREATE_ATTRS = clusters.CREATION_ATTRIBUTES
CERTIFICATE_CREATE_ATTRS = certificates.CREATION_ATTRIBUTES
QUOTA_CREATION_ATTRIBUTES = quotas.CREATION_ATTRIBUTES
CLUSTER_UPDATE_ALLOWED_PROPERTIES = set(['/node_count'])


def _cleanup_params(attrs, create, **params):
    args = {}
    for (key, value) in params.items():
        if key in attrs:
            if value is None:
                if create:
                    value = ''
                else:
                    continue
            args[str(key)] = str(value)
        elif create:
            raise exceptions.BadRequest(
                "Key must be in %s" % ",".join(attrs))
        if key == "labels":
            if isinstance(value, str) or isinstance(value, unicode):
                labels = {}
                vals = value.split(",")
                for v in vals:
                    kv = v.split("=", 1)
                    labels[kv[0]] = kv[1]
                args["labels"] = labels
            else:
                args["labels"] = value
    return args


def _create_patches(old, new):
    """"Create patches for updating cluster template and cluster

    Returns patches include operations for each parameters to update values
    """
    # old = {'a': 'A', 'b': 'B', 'c': 'C', 'd': 'D', 'e': 'E'}
    # new = {'a': 'A', 'c': 'c', 'd': None, 'e': '', 'f': 'F'}
    # patch = [
    #     {'op': 'add', 'path': '/f', 'value': 'F'}
    #     {'op': 'remove', 'path': '/b'},
    #     {'op': 'remove', 'path': '/e'},
    #     {'op': 'remove', 'path': '/d'},
    #     {'op': 'replace', 'path': '/c', 'value': 'c'}
    # ]

    patch = []

    for key in new:
        path = '/' + key
        if key in old and old[key] != new[key]:
            if new[key] is None or new[key] is '':
                patch.append({'op': 'remove', 'path': path})
            else:
                patch.append({'op': 'replace', 'path': path,
                              'value': new[key]})
        elif key not in old:
            patch.append({'op': 'add', 'path': path, 'value': new[key]})

    for key in old:
        path = '/' + key
        if key not in new:
            patch.append({'op': 'remove', 'path': path})

    # convert dict value for labels into string
    for p in patch:
        if 'value' in p:
            p['value'] = str(p['value'])
    return patch


@memoized
def magnumclient(request):
    magnum_url = ""
    try:
        magnum_url = base.url_for(request, 'container-infra')
    except exceptions.ServiceCatalogException:
        LOG.debug('No Container Infrastructure Management service is '
                  'configured.')
        return None

    LOG.debug('magnumclient connection created using the token "%s" and url'
              '"%s"' % (request.user.token.id, magnum_url))

    insecure = getattr(settings, 'OPENSTACK_SSL_NO_VERIFY', False)
    cacert = getattr(settings, 'OPENSTACK_SSL_CACERT', None)

    c = magnum_client.Client(username=request.user.username,
                             project_id=request.user.tenant_id,
                             input_auth_token=request.user.token.id,
                             magnum_url=magnum_url,
                             insecure=insecure,
                             cacert=cacert)
    return c


def cluster_template_create(request, **kwargs):
    args = _cleanup_params(CLUSTER_TEMPLATE_CREATE_ATTRS, True, **kwargs)
    return magnumclient(request).cluster_templates.create(**args)


def cluster_template_update(request, id, **kwargs):
    new = _cleanup_params(CLUSTER_TEMPLATE_CREATE_ATTRS, True, **kwargs)
    old = magnumclient(request).cluster_templates.get(id).to_dict()
    old = _cleanup_params(CLUSTER_TEMPLATE_CREATE_ATTRS, False, **old)
    patch = _create_patches(old, new)
    # NOTE(flwang): Now Magnum only support updating the node count for
    # cluster upddate action. So let's simplify it by only passing the
    # /node_count dict which can avoid many potential bugs.
    patch = [d for d in patch if d['path']
             in CLUSTER_UPDATE_ALLOWED_PROPERTIES]
    return magnumclient(request).cluster_templates.update(id, patch)


def cluster_template_delete(request, id):
    return magnumclient(request).cluster_templates.delete(id)


def cluster_template_list(request, limit=None, marker=None, sort_key=None,
                          sort_dir=None, detail=True):
    return magnumclient(request).cluster_templates.list(
        limit, marker, sort_key, sort_dir, detail)


def cluster_template_show(request, id):
    return magnumclient(request).cluster_templates.get(id)


def cluster_create(request, **kwargs):
    kwargs.pop("rollback")
    args = _cleanup_params(CLUSTER_CREATE_ATTRS, True, **kwargs)
    return magnumclient(request).clusters.create(**args)


def cluster_update(request, id, **kwargs):
    rollback = kwargs.pop("rollback")
    new = _cleanup_params(CLUSTER_CREATE_ATTRS, True, **kwargs)
    old = magnumclient(request).clusters.get(id).to_dict()
    old = _cleanup_params(CLUSTER_CREATE_ATTRS, False, **old)
    patch = _create_patches(old, new)
    return magnumclient(request).clusters.update(id, patch, rollback=rollback)


def cluster_delete(request, id):
    return magnumclient(request).clusters.delete(id)


def cluster_list(request, limit=None, marker=None, sort_key=None,
                 sort_dir=None, detail=True):
    return magnumclient(request).clusters.list(limit, marker, sort_key,
                                               sort_dir, detail)


def cluster_show(request, id):
    return magnumclient(request).clusters.get(id)


def certificate_create(request, **kwargs):
    args = {}
    for (key, value) in kwargs.items():
        if key in CERTIFICATE_CREATE_ATTRS:
            args[key] = value
        else:
            raise exceptions.BadRequest(
                "Key must be in %s" % ",".join(CERTIFICATE_CREATE_ATTRS))
    return magnumclient(request).certificates.create(**args)


def certificate_show(request, id):
    return magnumclient(request).certificates.get(id)


def certificate_rotate(request, id):
    args = {"cluster_uuid": id}
    return magnumclient(request).certificates.rotate_ca(**args)


def stats_list(request, project_id=None):
    return magnumclient(request).stats.list(project_id=project_id)


def quotas_list(request, limit=None, marker=None, sort_key=None,
                sort_dir=None, all_tenants=True):
    return magnumclient(request).quotas.list(
        limit, marker, sort_key, sort_dir, all_tenants)


def quotas_show(request, project_id, resource):
    return magnumclient(request).quotas.get(project_id, resource)


def quotas_create(request, **kwargs):
    args = _cleanup_params(QUOTA_CREATION_ATTRIBUTES, True, **kwargs)
    return magnumclient(request).quotas.create(**args)


def quotas_update(request, project_id, resource, **kwargs):
    new = _cleanup_params(QUOTA_CREATION_ATTRIBUTES, True, **kwargs)
    old = magnumclient(request).quotas.get(project_id, resource).to_dict()
    old = _cleanup_params(QUOTA_CREATION_ATTRIBUTES, False, **old)
    patch = _create_patches(old, new)
    return magnumclient(request).quotas.update(project_id, resource, patch)


def quotas_delete(request, project_id, resource):
    return magnumclient(request).quotas.delete(project_id, resource)
