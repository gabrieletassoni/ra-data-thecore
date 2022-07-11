import {
    fetchUtils
} from 'ra-core';
import {
    stringify
} from 'query-string';

/**
 * Maps react-admin queries to a simple REST API
 *
 * This REST dialect is similar to the one of FakeRest
 *
 * @see https://github.com/marmelab/FakeRest
 *
 * @example
 *
 * getList     => GET http://my.api.url/posts?sort=['title','ASC']&range=[0, 24]
 * getOne      => GET http://my.api.url/posts/123
 * getMany     => GET http://my.api.url/posts?filter={id:[123,456,789]}
 * update      => PUT http://my.api.url/posts/123
 * create      => POST http://my.api.url/posts
 * delete      => DELETE http://my.api.url/posts/123
 *
 * @example
 *
 * import * as React from "react";
 * import { Admin, Resource } from 'react-admin';
 * import simpleRestProvider from 'ra-data-simple-rest';
 *
 * import { PostList } from './posts';
 *
 * const App = () => (
 *     <Admin dataProvider={simpleRestProvider('http://path.to.my.api/')}>
 *         <Resource name="posts" list={PostList} />
 *     </Admin>
 * );
 *
 * export default App;
 */

function computeFilters(object, page, perPage, field, order, target, id) {
    let filters = {};
    // Generic filters
    for (const [key, value] of Object.entries(object)) filters[`${key}_eq`] = value;

    // Specific filter for getManyReference
    if (target && id) filters[`${target}_eq`] = id;

    const query = {
        q: {
            s: JSON.stringify(`${field} ${order}`),
            ...filters
        },
        page: page,
        per: perPage
    };
    return query;
}

export default (
    apiUrl,
    httpClient = fetchUtils.fetchJson,
    countHeader = 'Content-Range'
) => ({
    // getList
    // GET http://path.to.my.api/users?q[s]=["email ASC"]&page=1&per=4
    // HTTP/1.1 200 OK
    // Content-Type: application/json
    // Content-Range: posts 0-4/27
    // [
    //     { "id": 126, "title": "allo?", "author_id": 12 },
    //     { "id": 127, "title": "bien le bonjour", "author_id": 12 },
    //     { "id": 124, "title": "good day sunshine", "author_id": 12 },
    //     { "id": 123, "title": "hello, world", "author_id": 12 },
    //     { "id": 125, "title": "howdy partner", "author_id": 12 }
    // ]
    getList: (resource, params) => {
        const {
            page,
            perPage
        } = params.paginate;
        const {
            field,
            order
        } = params.sort;

        const query = computeFilters(params.filter, page, perPage, field, order);

        const url = `${apiUrl}/${resource}?${stringify(query)}`;

        return httpClient(url).then(({
            headers,
            json
        }) => ({
            data: json,
            total: parseInt(headers.get(countHeader).split('/').pop(), 10),
        }));
    },

    // getOne
    // GET http://path.to.my.api/posts/123
    // HTTP/1.1 200 OK
    // Content-Type: application/json
    // { "id": 123, "title": "hello, world", "author_id": 12 }
    getOne: (resource, params) =>
        httpClient(`${apiUrl}/${resource}/${params.id}`).then(({
            json
        }) => ({
            data: json,
        })),

    // getMany
    // GET http://path.to.my.api/posts?q[id_in][]=123&q[id_in][]=124&q[id_in][]=125
    // HTTP/1.1 200 OK
    // Content-Type: application/json
    // [
    //     { "id": 123, "title": "hello, world", "author_id": 12 },
    //     { "id": 124, "title": "good day sunshine", "author_id": 12 },
    //     { "id": 125, "title": "howdy partner", "author_id": 12 }
    // ]
    getMany: (resource, params) => {
        // q[id_in][]=34&q[id_in][]=45
        let query = [];
        for (const id of params.ids) {
            query.push(`q["id_in"][]=${id}`);
        }
        const url = `${apiUrl}/${resource}?${query.join("&")}`;
        return httpClient(url).then(({
            json
        }) => ({
            data: json
        }));
    },

    // getManyReference
    // GET http://path.to.my.api/comments?q[s]=["email ASC"]&page=1&per=4&q[post_id_eq]=1
    // HTTP/1.1 200 OK
    // Content-Type: application/json
    // Content-Range: comments 0-1/2
    // [
    //     { "id": 667, "title": "I agree", "post_id": 123 },
    //     { "id": 895, "title": "I don't agree", "post_id": 123 }
    // ]
    getManyReference: (resource, params) => {
        const {
            page,
            perPage
        } = params.pagination;
        const {
            field,
            order
        } = params.sort;

        const query = computeFilters(params.filter, page, perPage, field, order, params.target, params.id);

        const url = `${apiUrl}/${resource}?${stringify(query)}`;

        return httpClient(url).then(({
            headers,
            json
        }) => ({
            data: json,
            total: parseInt(headers.get(countHeader).split('/').pop(), 10),
        }));
    },

    // create
    // POST http://path.to.my.api/posts
    // { "title": "hello, world", "author_id": 12 }
    // HTTP/1.1 200 OK
    // Content-Type: application/json
    // { "id": 123, "title": "hello, world", "author_id": 12 }
    create: (resource, params) =>
        httpClient(`${apiUrl}/${resource}`, {
            method: 'POST',
            body: JSON.stringify({
                [resource]: params.data
            }),
        }).then(({
            json
        }) => ({
            data: {
                ...params.data,
                id: json.id
            },
        })),

    // update
    // PUT http://path.to.my.api/posts/123
    // { "title": "hello, world!" }
    // HTTP/1.1 200 OK
    // Content-Type: application/json
    // { "id": 123, "title": "hello, world!", "author_id": 12 }
    update: (resource, params) =>
        httpClient(`${apiUrl}/${resource}/${params.id}`, {
            method: 'PUT',
            body: JSON.stringify({
                [resource]: params.data
            }),
        }).then(({
            json
        }) => ({
            data: json
        })),

    // updateMany
    // PUT http://path.to.my.api/posts?ids=123,124,125
    // { "title": "hello, world!" }
    // HTTP/1.1 200 OK
    // Content-Type: application/json
    // [123, 124, 125]
    updateMany: (resource, params) => {
        const query = {
            ids: JSON.stringify(params.ids.join(","))
        };
        return httpClient(`${apiUrl}/${resource}/multi?${stringify(query)}`, {
            method: 'PUT',
            body: JSON.stringify({
                [resource]: params.data
            }),
        }).then(({
            json
        }) => ({
            data: json
        }));
    },

    // delete
    // DELETE http://path.to.my.api/posts/123
    // HTTP/1.1 200 OK
    // Content-Type: application/json
    // { "id": 123, "title": "hello, world", "author_id": 12 }
    delete: (resource, params) =>
        httpClient(`${apiUrl}/${resource}/${params.id}`, {
            method: 'DELETE',
        }).then(({
            json
        }) => ({
            data: json
        })),

    // deleteMany
    // DELETE http://path.to.my.api/posts?ids=123,124,125
    // HTTP/1.1 200 OK
    // Content-Type: application/json
    // [123, 124, 125]
    deleteMany: (resource, params) => {
        const query = {
            ids: JSON.stringify(params.ids.join(","))
        };
        return httpClient(`${apiUrl}/${resource}/multi?${stringify(query)}`, {
            method: 'DELETE'
        }).then(({
            json
        }) => ({
            data: json
        }));
    },
});