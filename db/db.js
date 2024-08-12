// db/Db.js
const {logError} = require("../logger/logger");
const sqlite3 = require('sqlite3').verbose();

class Db {
    constructor(dbPath) {
        this.dbPath = dbPath;
    }

    createTables() {
        const db = new sqlite3.Database(this.dbPath);

        db.serialize(() => {
            db.run(`CREATE TABLE IF NOT EXISTS dresses (
                id TEXT PRIMARY KEY,
                name TEXT,
                description TEXT,
                quantity INTEGER,
                section_id INTEGER
            )`);

            db.run(`CREATE TABLE IF NOT EXISTS deals (
                id TEXT PRIMARY KEY,
                title TEXT,
                contact_id TEXT,
                begindate TEXT,
                closedate TEXT,
                weddingdate TEXT,
                stage_id TEXT,
                prepayment TEXT,
                postpayment TEXT,
                opportunity TEXT
            )`);

            db.run(`CREATE TABLE IF NOT EXISTS contacts (
                id TEXT PRIMARY KEY,
                name TEXT,
                last_name TEXT,
                phone TEXT
            )`);

            db.run(`CREATE TABLE IF NOT EXISTS deal_dress (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                deal_id TEXT,
                product_id TEXT
            )`);
        });

        db.close();
    }

    async insertDataIntoTables(products, contacts) {
        const db = new sqlite3.Database(this.dbPath);

        // Записываем продукты
        const insertProductStmt = db.prepare(`INSERT OR REPLACE INTO dresses (id, name, description, quantity, section_id) VALUES (?, ?, ?, ?, ?)`);
        const insertDressDealStmt = db.prepare(`INSERT OR REPLACE INTO deal_dress (product_id, deal_id) VALUES(?, ?)`)
        const insertDealStmt = db.prepare(`INSERT OR REPLACE INTO deals (id, title, contact_id, begindate, closedate, weddingdate, stage_id) VALUES (?, ?, ?, ?, ?, ?, ?)`);

        products.forEach(product => {
            insertProductStmt.run(product.ID, product.NAME, product.DESCRIPTION, product.QUANTITY, product.SECTION_ID);
            if (product.deals.length > 0) {
                product.deals.forEach(deal => {
                    insertDealStmt.run(deal.ID, deal.TITLE, deal.CONTACT?.ID, deal.BEGINDATE, deal.CLOSEDATE, deal.WEDDING_DATE, deal.STAGE_ID);
                    insertDressDealStmt.run(product.ID, deal.ID)
                })
            }
        });
        insertProductStmt.finalize();
        insertDressDealStmt.finalize();
        insertDealStmt.finalize();

        // Записываем контакты
        const insertContactStmt = db.prepare(`INSERT OR REPLACE INTO contacts (id, name, last_name, phone) VALUES (?, ?, ?, ?)`);
        contacts.forEach(contact => {
            insertContactStmt.run(contact.ID, contact.NAME, contact.LAST_NAME, contact.PHONE);
        });
        insertContactStmt.finalize();

        db.close();
    }

    async insertContact(name, lastName, phone, id) {
        const db = new sqlite3.Database(this.dbPath);
        try {
            const insertContactStmt = db.prepare(`INSERT OR REPLACE INTO contacts (id, name, last_name, phone) VALUES (?, ?, ?, ?)`);
            insertContactStmt.run(id, name, lastName, phone);
            insertContactStmt.finalize();
        } catch (error) {
            logError("DB SERVICE insertContact", error);
            return null;
        } finally {
            db.close();
        }
    }

    async insertDeal(title, contact_id, dateFrom, dateTo, weddingDate, prepayment, postpayment, opportunity, id, products) {
        const db = new sqlite3.Database(this.dbPath);
        try {
            const insertDealStmt = db.prepare(`INSERT OR REPLACE INTO deals (id, title, begindate, closedate, weddingdate, stage_id, prepayment, postpayment, opportunity, contact_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
            insertDealStmt.run(id, title, dateFrom, dateTo, weddingDate, "NEW", prepayment, postpayment, opportunity, contact_id);

            const insertDealDressStmt = db.prepare(`INSERT OR REPLACE INTO deal_dress (deal_id, product_id) VALUES(?, ?)`)
            products.forEach(product => {
                insertDealDressStmt.run(id, product.ID)
            })

            insertDealDressStmt.finalize();
            insertDealStmt.finalize();
        } catch (error) {
            logError("DB SERVICE insertDeal", error);
            return null;
        } finally {
            db.close();
        }
    }

    async getProductsAndDeals() {
        const db = new sqlite3.Database(this.dbPath);

        const getDresses = () => {
            return new Promise((resolve, reject) => {
                db.all(`SELECT id AS ID, name AS NAME, quantity AS QUANTITY, section_id AS SECTION_ID, description AS DESCRIPTION FROM dresses`, [], (err, rows) => {
                    if (err) {
                        reject(err);
                    } else {
                        resolve(rows);
                    }
                });
            });
        };

        const getDeals = () => {
            return new Promise((resolve, reject) => {
                db.all(`SELECT * FROM deals`, [], (err, rows) => {
                    if (err) {
                        reject(err);
                    } else {
                        resolve(rows);
                    }
                });
            });
        };

        const getContacts = () => {
            return new Promise((resolve, reject) => {
                db.all(`SELECT * FROM contacts`, [], (err, rows) => {
                    if (err) {
                        reject(err);
                    } else {
                        resolve(rows);
                    }
                });
            });
        };

        const getDealDressRelations = () => {
            return new Promise((resolve, reject) => {
                db.all(`SELECT * FROM deal_dress`, [], (err, rows) => {
                    if (err) {
                        reject(err);
                    } else {
                        resolve(rows);
                    }
                });
            });
        };

        try {
            const [dresses, deals, contacts, dealDressRelations] = await Promise.all([getDresses(), getDeals(), getContacts(), getDealDressRelations()]);

            dresses.forEach(dress => {
                dress.deals = dealDressRelations
                    .filter(relation => relation.product_id === dress.ID)
                    .map(relation => {
                        const deal = deals.find(d => d.id === relation.deal_id);
                        const contact = contacts.find(c => c.id === deal.contact_id);
                        return {
                            ID: deal.id,
                            TITLE: deal.title,
                            CONTACT: {
                                ID: contact.id,
                                NAME: contact.name,
                                LAST_NAME: contact.last_name,
                                PHONE: contact.phone,
                            },
                            BEGINDATE: deal.begindate,
                            CLOSEDATE: deal.closedate,
                            STAGE_ID: deal.stage_id,
                            WEDDING_DATE: deal.weddingdate,
                        };
                    });
            });

            return dresses;
        } catch (error) {
            throw error;
        } finally {
            db.close();
        }
    }

    async getContacts(){
        const db = new sqlite3.Database(this.dbPath);
        try {
            return new Promise((resolve, reject) => {
                db.all(`SELECT id AS ID, name AS NAME, last_name AS LAST_NAME, phone AS PHONE FROM contacts`, [], (err, rows) => {
                    if (err) {
                        reject(err)
                    } else {
                        resolve(rows);
                    }
                })
            })
        } catch (error) {
            logError("DB SERVICE getContacts", error);
            return null;
        } finally {
            db.close();
        }
    }

    async removeDealFromDb(dealId) {
        const db = new sqlite3.Database(this.dbPath);

        const removeDeal = () => {
            return new Promise((resolve, reject) => {
                db.run(`DELETE FROM deals WHERE id = ?`, [dealId], function(err) {
                    if (err) {
                        reject(err);
                    } else {
                        resolve(this.changes); // returns number of rows affected
                    }
                });
            });
        };

        const removeDealDressRelations = () => {
            return new Promise((resolve, reject) => {
                db.run(`DELETE FROM deal_dress WHERE deal_id = ?`, [dealId], function(err) {
                    if (err) {
                        reject(err);
                    } else {
                        resolve(this.changes); // returns number of rows affected
                    }
                });
            });
        };

        try {
            await Promise.all([removeDeal(), removeDealDressRelations()]);
            return true;
        } catch (error) {
            logError("DB SERVICE removeDealFromDb", error);
            return false;
        } finally {
            db.close();
        }
    }

    async getMaxProductIdFromDb() {
        const db = new sqlite3.Database(this.dbPath);
        try {
            return new Promise((resolve, reject) => {
                db.get(`SELECT MAX(CAST(id AS INTEGER)) AS maxId FROM dresses`, [], (err, row) => {
                    if (err) {
                        logError("DB SERVICE getMaxProductIdFromDb", err);
                        reject(err);
                    } else {
                        resolve(row.maxId);
                    }
                });
            });
        } catch (error) {
            logError("DB SERVICE getMaxProductIdFromDb", error);
            return null;
        } finally {
            db.close();
        }
    }

    async getMaxDealIdFromDb() {
        const db = new sqlite3.Database(this.dbPath);
        try {
            return new Promise((resolve, reject) => {
                db.get(`SELECT MAX(CAST(id AS INTEGER)) AS maxId FROM deals`, [], (err, row) => {
                    if (err) {
                        logError("DB SERVICE getMaxProductIdFromDb", err);
                        reject(err);
                    } else {
                        resolve(row.maxId);
                    }
                });
            })
        } catch (error) {
            logError("DB SERVICE getMaxProductIdFromDb", error);
            return null;
        } finally {
            db.close();
        }
    }

    async getMaxContactIdFromDb() {
        const db = new sqlite3.Database(this.dbPath);
        try {
            return new Promise((resolve, reject) => {
                db.get(`SELECT MAX(CAST(id AS INTEGER)) AS maxId FROM contacts`, [], (err, row) => {
                    if (err) {
                        logError("DB SERVICE getMaxProductIdFromDb", err);
                        reject(err);
                    } else {
                        resolve(row.maxId);
                    }
                });
            })
        } catch (error) {
            logError("DB SERVICE getMaxProductIdFromDb", error);
            return null;
        } finally {
            db.close();
        }
    }

    async deleteProductFromDb(productId) {
        const db = new sqlite3.Database(this.dbPath);
        try {
            return new Promise((resolve, reject) => {
                db.run(`DELETE FROM dresses WHERE id = ?`, [productId], function(err) {
                    if (err) {
                        logError("DB SERVICE deleteProductFromDb", err);
                        reject(err);
                    } else {
                        resolve({ success: true, message: `Product with ID ${productId} has been deleted.` });
                    }
                });
            });
        } catch (error) {
            logError("DB SERVICE deleteProductFromDb", error);
            return null;
        } finally {
            db.close();
        }
    }

    async updateProductInDb(productId, product) {
        const db = new sqlite3.Database(this.dbPath);
        try {
            return new Promise((resolve, reject) => {
                db.run(
                    `UPDATE dresses SET name = ?, description = ?, section_id = ? WHERE id = ?`,
                    [product.NAME, product.DESCRIPTION, product.SECTION_ID, productId],
                    function(err) {
                        if (err) {
                            logError("DB SERVICE updateProductInDb", err);
                            reject(err);
                        } else if (this.changes === 0) {
                            resolve(false);
                        } else {
                            resolve(true);
                        }
                    }
                );
            });
        } catch (error) {
            logError("DB SERVICE updateProductInDb", error);
            return null;
        } finally {
            db.close();
        }
    }

}

module.exports = Db;
