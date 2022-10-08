/*
 * This file is part of Super Simple Highlighter.
 * 
 * Super Simple Highlighter is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 * 
 * Super Simple Highlighter is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 * 
 * You should have received a copy of the GNU General Public License
 * along with Foobar.  If not, see <http://www.gnu.org/licenses/>.
 */

/**
 * Database access 
 * 
 * @class DB
 */
class DB {
  /**
   * Creates an instance of DB.
   * @memberof DB
   */
  constructor() {
    this._db = null
  }

  // properties

  /**
   * Does the class have an internal instance of PouchDB
   * 
   * @internal
   * @readonly
   * @memberof DB
   */
  get hasDB() {
    return this._db != null
  }

  // methods

  /**
   * Get internal PouchDB instance, creating if required
   * 
   * @private
   * @returns {Promise<PouchDB>} promise resolving to PouchDB instance
   * @memberof DB
   */
  getDB() {
    if (this.hasDB) {
      return Promise.resolve(this._db)
    }

    // try to open existing db
    const db = new PouchDB(DB.NAME, DB.OPTIONS)

    return db.info().then(({doc_count, update_seq}) => {
      // if the db is empty assume it is new
      if (doc_count !== 0/* || update_seq !== 0*/) {
        return
      }

      // put design docs
      return DB.putDesignDocuments(db)
    }).then(() => {
      // store
      console.assert(!this.hasDB, "DB already has PouchDB instance")
      this._db = db

      return db
    }) 
  }

  /**
   * Close the database, this closes any open connection to the underlying storage and frees memory (event listeners) the database may be using.
   * 
   * @returns {Promise}
   * @memberof DB
   */
  closeDB() {
    if (!this.hasDB) {
      return Promise.resolve()
    }

    return this.getDB().then(db => db.close())
  }

  /**
   * Destroy (delete) the Pouch database
   * 
   * @returns {Promise} promise when DB is deleted and cached instance released
   * @memberof DB
   */
  destroyDB() {
    return this.getDB().then(db => db.destroy()).then(() => {
      this._db = null
    })
  }

  /** 
   * @typedef {Object} PutResponse
   * @prop {boolean} ok - true if operation succeeded
   * @prop {string} id - id of document
   * @prop {string} rev - revision of document
   */

  /**
   * Put document into DB
   * 
   * @private
   * @param {Object} doc - document to put
   * @param {Object} [identifiers={id, rev}] - no id implies it's defined on document instead (as _id)
   * @param {Object} [options] - options 
   * @returns {Promise<PutResponse>}
   * @memberof DB
   */
  putDB(doc, {id=undefined, rev=undefined} = {}, options = {}) {
    return this.getDB().then(db => {
      // fast path
      if (!id && !rev) {
        if (!doc._id) {
          throw new Error('undefined document id')
        }

        return db.put(doc, options)
      }

      // doc with specified id/rev
      const d = Object.assign({}, doc)

      if (id) {
        d._id = id
      }

      if (rev) {
        d._rev = rev
      }

      if (!d._id) {
        throw new Error('undefined document id')
      }
      return db.put(d, options)
    })
  }

  /**
   * Post document into DB (new ID)
   * 
   * @private
   * @param {Object} doc - document to post
   * @param {any} [options] - post options
   * @returns {Promise<PutResponse>}
   * @memberof DB
   */
  postDB(doc, options = {}) {
    return this.getDB().then(db => db.post(doc, options))
  }

  /**
   * Create, update or delete multiple documents
   * 
   * If you omit an _id parameter on a given document, the database will create a new document and assign the ID for you.
   * To update a document, you must include both an _id parameter and a _rev parameter, which should 
   * match the ID and revision of the document on which to base your updates.
   * Finally, to delete a document, include a _deleted parameter with the value true.
   * 
   * @param {Document[]} docs - array of docs. 
   * @param {Object} [options] 
   * @returns {Promise<PutResponse[]>}
   * @memberof DB
   */
  bulkDocsDB(docs, options) {
    return this.getDB().then(db => db.bulkDocs(docs, options))
  }

  /**
   * Remove a document
   *
   * @param {string} docId - document id
   * @param {string} docRev - document revision
   * @param {Object} [options] - deletion options
   * @returns {Promise<PutResponse>} object with ok/id/rev properties
   * @memberof DB
   */
  removeDB(docId, docRev, options) {
    return this.getDB().then(db => db.remove(docId, docRev, options))
  }

  /** 
   * @typedef {Object} QueryResponse
   * @prop {number} offset - ?
   * @prop {QueryRow[]} rows - array of document objects
   * @prop {number} total_rows - length of rows array
   */

  /** 
   * @typedef {Object} QueryRow
   * @prop {string} id - document id
   * @prop {string} key - 
   * @prop {*} value - 
   * @prop {Object} doc - document
   */

  /**
   * Invoke a map/reduce function
   * 
   * @param {Object|Function|string} fun - Map/reduce function, which can be one of the following:
   * @param {Object} [options] options
   * @returns {Promise<QueryResponse>}
   * @memberof DB
   */
  queryDB(fun, options) {
    return this.getDB().then(db => db.query(fun, options))
  }

  // resetDB() {
  //   if (!this.hasDB) {
  //     return this.getDB()
  //   }

  //   return this.destroyDB().then(() => this.getDB())
  // }

  /**
   * As design docs are deleted or modified, their associated index files (in CouchDB) or companion databases
   * (in local PouchDBs) continue to take up space on disk. viewCleanup() removes these unnecessary index files.
   * 
   * @returns {Promise}
   * @memberof DB
   */
  viewCleanupDB() {
    return this.getDB().then(db => db.viewCleanup())
  }
  
  /**
   * Runs compaction of the database. 
   * 
   * @returns {Promise}
   * @memberof DB
   */
  compactDB() {
    return this.getDB().then(db => db.compact())
  }

  /**
   * Dump PouchDB to a stream object (with replication stream plugin)
   * 
   * @param {Object} stream 
   * @returns {Promise}
   * @memberof DB
   */
  dumpDB(stream) {
    // const re = new RegExp(`^${DB.DESIGN_VIEW_PREFIX}/`)
    return this.getDB().then(db => {
      const re = new RegExp(`^${DB.DESIGN_VIEW_PREFIX}/`)

      return db.dump(stream, {
        // don't include internal documents
        filter: ({_id}) => !(_id.match(re)) 
      })
    })
  }

  /**
   * Load DB and replace contents of our DB
   * 
   * @param {string} urlOrString - source of db
   * @returns {Promise} resolves when loaded
   * @memberof DB
   */
  loadDB(urlOrString) {
    // load supplied db into a temporary db (probably makes no difference on chrome)
    const tmpDB = new PouchDB('_tmpdb', {storage: 'temporary'})

    return tmpDB.load(urlOrString).then(() => {
      // destroy existing database, and get it (i.e. empty and recrete)
      return this.destroyDB()
    }).then(() => this.getDB()).then(db => {
      // // replicate into db. Design docs were filtered out, so they won't be added twice
      return tmpDB.replicate.to(db, {live: false})
    }).then(() => {
			// cleanup tmp db
      return tmpDB.destroy()
    }).catch(e => {
      // cleanup tmp db on err
			return tmpDB.destroy().then(() => { throw e })
    })
  }

  //

  /**
   * Put a new document defining a created highlight
   * 
   * @param {string} match - string identifying url of page associated with document
   * @param {Object|string} xrange - object identifying range of highlight. Usually type XRange. Must be stringifyable.
   * @param {string} className - name of class identifying style of highlight
   * @param {string} text - text contained within highlight
   * @param {Object} optionals [{title = undefined, date = Date.now(), }={}] - optional things
   * @param {Object} [options] - options object
   * @returns {Promise<PutResponse>}
   * @memberof DB
   */
  putCreateDocument(match, xrange, className, text, {
    title = undefined,
    date = Date.now(),
  } = {}, options = {}) {
    // the document to be put (put because we specify the _id, which gets used as the DOM highlight id)
    // naive, but ok for now
    const components = chrome.runtime.getManifest()
      .version.split(".");
    const majorVersion = components.length > 0 ? parseInt(components[0]) : 4

    const doc = {
      [DB.DOCUMENT.NAME.VERB]: DB.DOCUMENT.VERB.CREATE,
      [DB.DOCUMENT.NAME.MATCH]: match,
      [DB.DOCUMENT.NAME.RANGE]: xrange,
      [DB.DOCUMENT.NAME.CLASS_NAME]: className,
      [DB.DOCUMENT.NAME.TEXT]: text,
      [DB.DOCUMENT.NAME.DATE]: date,
      [DB.DOCUMENT.NAME.VERSION]: majorVersion
    }

    // optionals
    if (typeof title === 'string') {
      doc[DB.DOCUMENT.NAME.TITLE] = title
    }

    return this.putDB(doc, { id: StringUtils.newUUID() })
  }

  /**
   * Update values of an existing `create` document
   * 
   * @param {string} docId - id of 'create' document to update
   * @param {any} values [{ className=undefined, title=undefined }={}] - new values
   * @param {any} [options={rev=undefined}] 
   * @returns {Promise<PutResponse>}
   * @memberof DB
   */
  updateCreateDocument(docId, {
    className=undefined, 
    title=undefined,
  } = {}, options = {}) {
    // options for getting existing 'create' doc
    const o = {}

    if (typeof options.rev === 'string') {
      o.rev = options.rev
    }

    return this.getDocument(docId, o).then(doc => {
      // verify its the correct type
      if (doc[DB.DOCUMENT.NAME.VERB] !== DB.DOCUMENT.VERB.CREATE) {
        throw new Error('incorrect verb')
      }

      // change required?
      if (className === doc[DB.DOCUMENT.NAME.CLASS_NAME] && 
        title === doc[DB.DOCUMENT.NAME.TITLE]) {
        // fake success
        return {
          ok: true,
					id: doc._id,
					rev: doc._rev
        }
      }

      if (className) {
        doc[DB.DOCUMENT.NAME.CLASS_NAME] = className
      }
      if (title) {
        doc[DB.DOCUMENT.NAME.TITLE] = title
      }
      
      // update existing doc
      return this.putDB(doc, {}, options)
    })
  }

  /**
   * Post a document detailing a highlight deletion
   * 
   * @param {string} createDocId - id of `create` doc that this document deletes
   * @param {Object} optionals [{date = Date.now(), }={}] - optional values
   * @param {Object} [options] - options
   * @returns {Promise<PutResponse>} object with ok/id/rev properties
   * @memberof DB
   */
  postDeleteDocument(createDocId, {
    date = Date.now(),
  }={}, options = {}) {
    // get the create doc that this must be associated with
    return this.getDocument(createDocId).then(correspondingDoc => {
      // must have correct type of correspondant
      if (correspondingDoc[DB.DOCUMENT.NAME.VERB] !== DB.DOCUMENT.VERB.CREATE) {
        throw new Error('incorrect corresponding verb')
      }

      // create a new document, detailing the 'delete' verb transaction
      // no need for createUUID, as it won't be used as an id/class attribute
      const doc = {
        [DB.DOCUMENT.NAME.VERB]: DB.DOCUMENT.VERB.DELETE,
        [DB.DOCUMENT.NAME.MATCH]: correspondingDoc[DB.DOCUMENT.NAME.MATCH],
        [DB.DOCUMENT.NAME.DATE]: date,
        [DB.DOCUMENT.NAME.CORRESPONDING_DOC_ID]: createDocId
      }

      return this.postDB(doc, options)
    })
  }

  //

  /** 
   * @typedef {Object} Document
   * @prop {string} _id - id of document
   * @prop {string} _rev - revision of document
   * 
   * @prop {string} match - string formed by processing the associated page's url
   * @prop {number} date - date of document put/post, as ns since 1970
   * @prop {string} verb - create or delete 
   * @prop {Object} [range] - creation document range with xPath 
   * @prop {string} [className] - className identifying style of create highlight. Used in DOM
   * @prop {string} [text] - text within create highlight
   * @prop {string} [title] - title of page highlight was created from
   * @prop {string} [correspondingDocumentId] - id of 'create' doc associated with this `delete` doc
   */

  /**
   * Get a document of any verb from the db
   * 
   * @param {string} docId - id of doc to fetch
   * @param {Object} [options={rev=undefined}] - fetch options. if 'rev' undefined default to winning version
   * @returns {Promise<Document>} - document promise
   * @memberof DB
   */
  getDocument(docId, options = {}) {
    return this.getDB().then(db => db.get(docId, options))
  }

  /**
   * Remove all documents that have a specified match value
   * 
   * @param {string} match - match string to search for
   * @param {Object} [options={}] - bulk delete options
   * @returns {Promise<PutResponse[]>}
   * @memberof DB
   */
  removeMatchingDocuments(match, options = {}) {
    return this.getMatchingDocuments(match).then(docs => {
      // this is the right way to bulk delete
      for (const d of docs) {
        d['_deleted'] = true
      }

      return this.bulkDocsDB(docs, options)
    })
  }

  /**
   * Remove every document for each match that has a create/delete sum of zero (i.e. it does nothing)
   * 
   * @param {Object} [options] - bulk docs removal options
   * @returns {Promise<PutResponse[][]>}
   * @memberof DB
   */
  removeAllSuperfluousDocuments(options = {}) {
    return this.getSums().then(rows => {
      return Promise.all(rows
          .filter(({value}) => value === 0)
          .map(({key}) => this.removeMatchingDocuments(key, options))
      )
    })
  }
  //

  /**
   * Get number of create documents, minus those with corresponding delete documents
   * 
   * @param {string} match - document match url string to search for
   * @returns {Promise<number>} number of documents. zero implies all matched documents can be removed
   * @memberof DB
   */
  getMatchingSum(match) {
    return this.queryDB(DB.VIEW_NAME.SUM, { key: match }).then(({rows}) => {
      return rows.length === 0 ? 0 : rows[0].value
    })
  }

  /**
   * As `getMatchingSum()`, but queried for every unique match in the database
   * 
   * @returns {Promise<QueryRow[]>} array of objects where key is the match string and value is the matching sum value.
   * @memberof DB
   */
  getSums() {
    return this.queryDB(DB.VIEW_NAME.SUM, {
      group: true,
      group_level: 1,
      include_docs: false
    }).then(({rows}) => { return rows })
  }

  //

  /**
   * Get all documents with the same match string
   * 
   * @param {string} match - match string to search for
   * @param {Object} options - [{
   *     descending=false,
   *     verbs=undefined,
   *     limit=undefined,
   *     excludeDeletedDocs=false,
   *   }={}] 
   * @returns {Promise<Document[]>}
   * @memberof DB
   */
  getMatchingDocuments(match, {
    descending=false,
    limit=undefined,
    verbs=undefined,
    excludeDeletedDocs=false,
  } = {}) {
    // query options
    const qo = {
      startkey: !descending ? [match] : [match, {}],
      endkey: !descending ? [match, {}] : [match],
      descending: descending,
      include_docs: true,
    }

    // limit number of results
    if (typeof limit === 'number') {
      qo.limit = limit
    }

    return this.queryDB(DB.VIEW_NAME.MATCH_DATE, qo).then(({rows}) => {
      let docs = rows.map(r => r.doc)

      // if true, remove all `create` documents for which a corresponding `delete` document exists.
      if (excludeDeletedDocs) {
        // set of ids of documents that can be removed
        const s = new Set()

        for (const d of docs.filter(d => d.verb === DB.DOCUMENT.VERB.DELETE)) {
          // add the id of the corresponding 'create' doc of this delete doc
          s.add(d[DB.DOCUMENT.NAME.CORRESPONDING_DOC_ID])
          // also remove the 'delete' document, as it won't referenceanything
          s.add(d._id)
        }

        docs = docs.filter(d => !s.has(d._id))
      }

      // filter by verb
      if (verbs) {
        const s = new Set(typeof verbs === 'string' ? [verbs] : verbs)
        
        docs = docs.filter(d => s.has(d[DB.DOCUMENT.NAME.VERB]))
      }

      return docs
    })
  }

  // static


  /**
   * Crete the standard design documents into a database
   * Note that no revision is defined, so it is assumed no documents already exist with this ID
   * 
   * @private
   * @param {Object} pouchDB - database to put into
   * @param {Object} [options] - bulkDocument options
   * @returns {Promise<PutResponse[]>}
   * @memberof DB
   */
  static putDesignDocuments(pouchDB, options = {}) {
    // note that we can't use [DB.DESIGN.DOCUMENT.VERB] directly in the stringified function
    console.assert(DB.DOCUMENT.VERB.CREATE === 'create')
    console.assert(DB.DOCUMENT.VERB.DELETE === 'delete')
    
    const docs = [
      {
        // _design/match_date_view
        _id: `${DB.DESIGN_VIEW_PREFIX}/${DB.VIEW_NAME.MATCH_DATE}`,
        views: {
          [DB.VIEW_NAME.MATCH_DATE]: {
            map: function (doc) {
              if (doc.match) {
                emit([doc.match, doc.date])
              }
            }.toString()
          }
        }
      }, {
        // _design/sum_view
        _id: `${DB.DESIGN_VIEW_PREFIX}/${DB.VIEW_NAME.SUM}`,
        views: {
          [DB.VIEW_NAME.SUM]: {
            map: function (doc) {
              // the values will be reduced with '_sum'. If that == 0, number of create == delete
              switch (doc.verb) {
                case 'create':
                    emit(doc.match, 1)
                    break

                case 'delete':
                    emit(doc.match, -1)
                    break
                }
              }.toString(),
            // internal method _sum
            reduce: "_sum"
          }
        }
      }
    ]

    return pouchDB.bulkDocs(docs, options)
  }
  /**
   * Sort documents
   * 
   * @static
   * @param {Document[]} docs - array of document objects
   * @param {Function} [comparator=(doc => Promise.resolve(doc.date))] - function returning a promise that resolves to something comparable. Defaults to date sort
   * @returns {Promise<Document[]>} array of sorted docs
   * @memberof DB
   */
  static sortDocuments(docs, comparator = (doc => Promise.resolve(doc.date))) {
    // object in which each attribute's value corresponds to the resolved
		// promise result for it. If the promise rejected, no attribute is
    // added. Every attribute's value must be of the same type
    const values = new Map()

    return Promise.all(docs.map(doc => {
      return comparator(doc).then(value => values.set(doc._id, value)).catch(() => { /* ignore */ })
    })).then(() => {
      // shallow copy docs, and sort it
      return docs.slice().sort((d1, d2) => {
        const v1 = values.get(d1._id)
        const v2 = values.get(d2._id)

        if (typeof v1 === 'undefined') {
          return (typeof v2 === 'undefined') ? 0 : -1;
        }
        if (typeof v2 === 'undefined') {
          return (typeof v1 === 'undefined') ? 0 : 1;
        }

        switch (typeof v1) {
          case 'string':
            return v1.localeCompare(v2)
          default:
            return v1 - v2
        }
      })
    })
  }

  /**
   * Form the string that a page URL will be associated with in the database
   * Note that the match is URI decoded by default
   * 
   * @static
   * @param {string|URL} url - url of page to process 
   * @param {string|URL} [frameUrl] - url of the frame specific to the match. May be null if same as pageUrl. NOT CURRENTLY USED
   * @param {Object} [options={scheme = true, query = true, fragment = false, decode = true }] - options object
   * @returns {string} match string
   * @memberof DB
   */
  static formatMatch(url, frameUrl, {
    scheme = true,
    query = true,
    fragment = false,
    decode = true,
  } = {}) {
    // @ts-ignore
    const u = (url instanceof URL && url) || new URL(url)

    // shortcut - basically the match is the entire url
    // if( scheme && query && fragment ) {
    //   return u.href
    // }

    // example.com
    let match = u.hostname

    // http://
    if (scheme) {
      match = `${u.protocol}//${match}`
    }

    // :8080
    if (u.port.length > 0) {
      match += `:${u.port}`
    }

    // /a/b 
    match += u.pathname

    // ?p=q&x=y
    if (query && u.search.length > 0) {
      match += u.search
    }

    // #id
    if (fragment && u.hash.length > 0) {
      match += u.hash
    }

    return decode ? decodeURI(match) : match
  }

}

// static

// name for main database
DB.NAME = 'http://localhost:3996/highlighter'
// options for main database 
DB.OPTIONS = {
  auto_compaction: true,
}

DB.DESIGN_VIEW_PREFIX = '_design'

// names of design documents in all db, used for map/reduce
DB.VIEW_NAME = {
  MATCH_DATE: 'match_date_view',
  SUM: 'sum_view',
}

DB.DOCUMENT = {
  // verbs assigned to documents identifying each highlight
  VERB: {
    CREATE: 'create',
    DELETE: 'delete'
  },

  // object property names
  NAME: {
    // string formed by processing the associated page's url
    MATCH: 'match',
    // date of document put/post
    DATE: 'date',
    // verb defining document
    VERB: 'verb',
    // stringifyed xrange object
    RANGE: 'range',
    // className identifying style of highlight
    CLASS_NAME: 'className',
    // text within highlight
    TEXT: 'text',
    // page title of create doc
    TITLE: 'title',
    // id of 'create' doc associated with this `delete` doc
    CORRESPONDING_DOC_ID: 'correspondingDocumentId',
    // version of ssh used to create document. Only used ssh v4+
    VERSION: 'v'
  }
}