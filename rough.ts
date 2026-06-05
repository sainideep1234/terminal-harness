import sqlite3 from 'sqlite3'
import { open } from 'sqlite'

export let db;
// this is a top-level await 
(async () => {
    // open the database
     db = await open({
        filename: '/tmp/database.db',
        driver: sqlite3.Database
      })
})()
try {
    await db.exec('CREATE TABLE session (col provider col model col api_key)')
    
} catch (error) {
    console.log(error)
}