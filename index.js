const express = require('express');
const bodyParser = require('body-parser');
const timeout = require("connect-timeout");
const cors = require("cors");
const dotenv = require('dotenv');
const path = require("path");
const fs = require('fs');
const Db = require('./db/db.js');

const {logError, logSuccess} = require("./logger/logger");
const { ProductsService } = require("./services/products");
const { DealsService } = require("./services/deals");
const { ContactsService } = require("./services/contacts");

const envPath = path.join(__dirname, '.env');
dotenv.config({ path: envPath });

const PORT = 4800;
const app = express();

const link = process.env.BX_LINK;

app.use(cors({
    origin: "*",
}));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

app.use(timeout('20m'));


function ensureDirectoriesExist() {
    const dirs = [
        path.join(__dirname, 'db', 'astana'),
        path.join(__dirname, 'db', 'karaganda')
    ];

    dirs.forEach(dir => {
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
            console.log(`Directory created: ${dir}`);
        }
    });
}

ensureDirectoriesExist();

const dbAstana = new Db(path.join(__dirname, 'db', 'astana', 'database.db'));
const dbKaraganda = new Db(path.join(__dirname, 'db', 'karaganda', 'database.db'));

dbAstana.createTables();
dbKaraganda.createTables();

app.post("/dressup/get_goods_from_db_and_new_goods", async (req, res) => {
    try {
        const raw = req.body;
        const productService = new ProductsService(link);
        const dealsService = new DealsService(link);
        const contactsService = new ContactsService(link);

        const iblocks = await productService.getIblocksList();
        const offersCatalogId = await productService.getOffersCatalogId(iblocks);

        let db;
        if (raw.city.toLowerCase() === 'астана') {
            db = dbAstana;
        } else if (raw.city.toLowerCase() === 'караганда') {
            db = dbKaraganda;
        } else {
            logError("/dressup/get_goods_from_db_and_new_goods", "неизвестный город!");
            res.status(400).json({"status": false, "status_msg": "error", "message": "Введен несуществующий город"});
        }


        const maxProductIdFromDb = await db.getMaxProductIdFromDb();
        const maxDealIdFromDb = await db.getMaxDealIdFromDb();
        const maxContactIdFromDb = await db.getMaxContactIdFromDb();

        let rawProducts = null;
        if (raw && raw.city) {
            rawProducts = await productService.fetchProductsFromId(maxProductIdFromDb, offersCatalogId, raw.city);
        } else {
            rawProducts = await productService.fetchProducts(offersCatalogId);
        }

        const dealsWithProductRows = await dealsService.getDealsWithProductrowsFromId(maxDealIdFromDb);
        const contacts = await contactsService.getAllContactsFromId(maxContactIdFromDb);

        rawProducts.forEach(product => {
            const productsInDeals = [];

            // Iterate over each deal in dealsWithProductRows
            dealsWithProductRows.forEach(deal => {
                // Find product rows that match the current productId
                const matchingRows = deal.productRows.filter(row => row.PRODUCT_ID?.toString() === product.ID?.toString() || row.PRODUCT_ID?.toString() === product.OFFER_ID?.toString());

                if (matchingRows.length > 0) {
                    // If matching rows found, add deal details to productsInDeals
                    productsInDeals.push({
                        ID: deal.id,
                        TITLE: deal.title,
                        CONTACT: contacts.find(contact => contact.ID.toString() === deal.contact_id.toString()),
                        BEGINDATE: deal.begin_date,
                        CLOSEDATE: deal.close_date,
                        STAGE_ID: deal.stage_id,
                        WEDDING_DATE: deal.wedding_date
                    });
                }
            });

            // Add deals field to the product
            product.deals = productsInDeals;
        });

        await db.insertDataIntoTables(rawProducts, contacts);

        const productsFromDb = await db.getProductsAndDeals(raw.city);

        rawProducts.push(...productsFromDb);

        res.status(200).json({ "status": true, "status_msg": "success", "products": rawProducts });
    } catch (error) {
        logError("/dressup/get_goods_from_db_and_new_goods", error);
        res.status(500).json({ "status": false, "status_msg": "error", "message": "что-то пошло не так" });
    }
})

app.post("/dressup/get_goods", async (req, res) => {
    try {
        const raw = req.body;
        const productService = new ProductsService(link);
        const dealsService = new DealsService(link);
        const contactsService = new ContactsService(link);

        const iblocks = await productService.getIblocksList();
        const offersCatalogId = await productService.getOffersCatalogId(iblocks);
        let rawProducts = null;
        if (raw && raw.city) {
            rawProducts = await productService.fetchProducts(offersCatalogId, raw.city);
        } else {
            rawProducts = await productService.fetchProducts(offersCatalogId);
        }

        const dealsWithProductRows = await dealsService.getDealsWithProductrows();
        const contacts = await contactsService.getAllContacts();

        // Iterate over each product in rawProducts and add deals field
        rawProducts.forEach(product => {
            const productsInDeals = [];

            // Iterate over each deal in dealsWithProductRows
            dealsWithProductRows.forEach(deal => {
                // Find product rows that match the current productId
                const matchingRows = deal.productRows.filter(row => row.PRODUCT_ID?.toString() === product.ID?.toString() || row.PRODUCT_ID?.toString() === product.OFFER_ID?.toString());

                if (matchingRows.length > 0) {
                    // If matching rows found, add deal details to productsInDeals
                    productsInDeals.push({
                        ID: deal.id,
                        TITLE: deal.title,
                        CONTACT: contacts.find(contact => contact.ID.toString() === deal.contact_id.toString()),
                        BEGINDATE: deal.begin_date,
                        CLOSEDATE: deal.close_date,
                        STAGE_ID: deal.stage_id,
                        WEDDING_DATE: deal.wedding_date
                    });
                }
            });

            // Add deals field to the product
            product.deals = productsInDeals;
        });

        // Определяем путь к базе данных в зависимости от города
        let db;
        if (raw.city.toLowerCase() === 'астана') {
            db = dbAstana;
        } else if (raw.city.toLowerCase() === 'караганда') {
            db = dbKaraganda;
        } else {
            logError("/dressup/get_goods", "неизвестный город!");
            res.status(400).json({"status": false, "status_msg": "error", "message": "Введен несуществующий город"});
        }

        // Записываем данные в соответствующие таблицы
        await db.insertDataIntoTables(rawProducts, contacts);

        res.status(200).json({ "status": true, "status_msg": "success", "products": rawProducts });
    } catch (error) {
        logError("/dressup/get_goods", error);
        res.status(500).json({ "status": false, "status_msg": "error", "message": "что-то пошло не так" });
    }
});

app.post("/dressup/get_goods_from_db", async (req, res) => {
    try {
        const raw = req.body;

        // Определяем путь к базе данных в зависимости от города
        let db;
        if (raw.city.toLowerCase() === 'астана') {
            db = dbAstana;
        } else if (raw.city.toLowerCase() === 'караганда') {
            db = dbKaraganda;
        } else {
            logError("/dressup/get_goods_from_db", "неизвестный город!");
            res.status(400).json({"status": false, "status_msg": "error", "message": "Введен несуществующий город"});
        }

        // Получаем данные из соответствующей базы данных
        const products = await db.getProductsAndDeals(raw.city);

        res.status(200).json({ "status": true, "status_msg": "success", "products": products });
    } catch (error) {
        logError("/dressup/get_good_from_db", error);
        res.status(500).json({ "status": false, "status_msg": "error", "message": "что-то пошло не так" });
    }
})

app.get("/dressup/get_sections/", async (req, res) => {
    try {
        const productService = new ProductsService(link);
        const sections = await productService.getSections()
        res.status(200).json({"status": true, "status_msg": "success", "sections": sections});
    } catch (error) {
        logError("/dressup/get_sections/", error);
        res.status(500).json({"status": false, "status_msg": "error", "message": "что-то пошло не так"})
    }
})

app.post("/dressup/get_product_pictures/", async (req, res) => {
    try {
        const raw = req.body;
        const productService = new ProductsService(link);
        const pictures = (await productService.getPictures(parseInt(raw.product_id))).map(picture => picture.detailUrl);
        res.status(200).json({"status": true, "status_msg": "success", "pictures": pictures})
    } catch (error) {
        logError("/dressup/get_product_pictures/", error);
        res.status(500).json({"status": false, "status_msg": "error", "message": "что-то пошло не так"})
    }
})

app.get("/dressup/get_quantities", async (req, res) => {
    try {
        const productsService = new ProductsService(link);
        const quantites = await productsService.getQuantities();
        res.status(200).json({"status": true, "status_msg": "success", "quantites": quantites});
    } catch (error) {
        logError("/dressup/get_info",error)
        res.status(500).json({"status": false, "status_msg": "error", "message": "что-то пошло не так"})
    }
})

app.get("/dressup/get_contacts", async (req, res) => {
    try {
        const contactsService = new ContactsService(link);
        const contacts = await contactsService.getAllContacts();
        res.status(200).json({"status": true, "status_msg": "success", "contacts": contacts});
    } catch (error) {
        logError("/dressup/get_contacts",error)
        res.status(500).json({"status": false, "status_msg": "error", "message": "что-то пошло не так"})
    }
})

app.post("/dressup/get_contacts_from_db", async (req, res) => {
    try {
        const raw = req.body;
        let db;
        if (raw.city.toLowerCase() === 'астана') {
            db = dbAstana;
        } else if (raw.city.toLowerCase() === 'караганда') {
            db = dbKaraganda;
        } else {
            logError("/dressup/get_goods", "неизвестный город!");
            res.status(400).json({"status": false, "status_msg": "error", "message": "Введен несуществующий город"});
        }

        const contacts = await db.getContacts();
        res.status(200).json({"status": true, "status_msg": "success", "contacts": contacts});
    } catch (error) {
        logError("/dressup/get_contacts_from_db",error)
        res.status(500).json({"status": false, "status_msg": "error", "message": "что-то пошло не так"})
    }
})

app.post("/dressup/create_deal", async (req, res) => {
    try {
        const raw = req.body;
        const dealsService = new DealsService(link)
        const dealId = await dealsService.createDeal(raw.title, raw.contact_id, raw.dateFrom, raw.dateTo, raw.weddingDate, raw.prepayment, raw.postpayment, raw.category_id)
        if (dealId) {
            const isProductsAdded = await dealsService.addProductsToDeal(dealId, raw.products);

            let db;
            if (raw.city.toLowerCase() === 'астана') {
                db = dbAstana;
            } else if (raw.city.toLowerCase() === 'караганда') {
                db = dbKaraganda;
            } else {
                logError("/dressup/get_goods", "неизвестный город!");
                res.status(400).json({"status": false, "status_msg": "error", "message": "Введен несуществующий город"});
            }

            await db.insertDeal(raw.title, raw.contact_id, raw.dateFrom, raw.dateTo, raw.weddingDate, raw.prepayment, raw.postpayment, raw.opportunity, dealId, raw.products);

            if (isProductsAdded) {
                const result = await dealsService.updateDealOpportunity(dealId, raw.opportunity);
                if (result) {
                    res.status(200).json({"status": true, "status_msg": "success", "message": `Сделка успешно создана и товары добавлены: ${true}`})
                } else {
                    res.status(500).json({"status": false, "status_msg": "error", "message": `Ошибка при создании сделки`})
                }
            } else {
                res.status(500).json({"status": false, "status_msg": "error"})
            }
        }

    } catch (error) {
        logError("/dressup/create_deal", error);
        res.status(500).json({"status": false, "status_msg": "error", "message": "что-то пошло не так"})
    }
})

app.post("/dressup/create_contact", async (req ,res) => {
    try {
        const raw = req.body;
        const contactsService = new ContactsService(link);
        const result = await contactsService.createContact(raw.name, raw.lastName, raw.phone);
        if (result) {

            let db;
            if (raw.city.toLowerCase() === 'астана') {
                db = dbAstana;
            } else if (raw.city.toLowerCase() === 'караганда') {
                db = dbKaraganda;
            } else {
                logError("/dressup/create_contact", "неизвестный город!");
                res.status(400).json({"status": false, "status_msg": "error", "message": "Введен несуществующий город"});
            }

            await db.insertContact(raw.name, raw.lastName, raw.phone, result);

            res.status(200).json({"status": true, "status_msg": "success", "message": `Контакт создан: ${result}`, "contact_id": result })
        } else {
            res.status(500).json({"status": false, "status_msg": "error", "message": "Ошибка при создании контакта"})
        }
    } catch (error) {
        logError("/dressup/create_contact", error);
        res.status(500).json({"status": false, "status_msg": "error", "message": "что-то пошло не так"})
    }
})

app.post("/dressup/remove_deal_from_db", async (req, res) => {
    try {
        const raw  = req.body;
        const dealId = raw.document_id[raw.document_id.length - 1].replace("DEAL_", "")
        let db;
        if (req.query.city.toLowerCase().replace("_", "") === 'астана') {
            db = dbAstana;
        } else if (req.query.city.toLowerCase().replace("_", "") === 'караганда') {
            db = dbKaraganda;
        } else {
            throw new Error("неизвестный город!")
        }

        const result = await db.removeDealFromDb(dealId);
        if (result) {
            logSuccess("/dressup/remove_deal_from_db", `Сделка ${dealId} успешно удалена`)
            res.status(200).json({"status": true, "status_msg": "success", "message": `Сделка ${dealId} успешно удалена`})
        }

    } catch (error) {
        logError("/dressup/remove_deal_from_db", error);
        res.status(500).json({"status": false, "status_msg": "error", "message": "что-то пошло не так"})
    }
})

app.get("/dressup/get_deal_categories/", async (req, res) => {
    try {
        const dealService = new DealsService(link);
        const categories = await dealService.getDealCategories();
        res.status(200).json({"status": true, "status_msg": "success", "categories": categories});
    } catch (error) {
        logError("/dressup/get_deal_categories/", error);
        res.status(500).json({"status": false, "status_msg": "error", "message": "что-то пошло не так"})
    }
})

app.get("/dressup/get_cities/", async (req, res) => {
    try {
        const productService = new ProductsService(link);
        const cities = await productService.getCityUserField();
        res.status(200).json({"status": true, "status_msg": "success", "cities": cities.values.map(city => city.VALUE)});
    } catch (error) {
        logError("/dressup/get_cities/", error);
        res.status(500).json({"status": false, "status_msg": "error", "message": "что-то пошло не так"})
    }
})

app.get("/dressup/tmp", async (req, res) => {
    const productService = new ProductsService(link);
    const userFields = await productService.getCityUserField();
    res.status(200).json({"status": true, "status_msg": "success", "userFields": userFields});
})

app.listen(PORT, () => {
    console.log(`Сервер запущен на порту ${PORT}`);
});