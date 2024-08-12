const {Bitrix} = require("@2bad/bitrix")
const {logError} = require("../logger/logger");

class ProductsService {
    bx = null;

    constructor(link) {
        this.bx = Bitrix(link);
    }

    async fetchProducts(iblockId, city = null) {
        try {
            let data = [];
            let crmProducts = null;
            const cityUserField = await this.getCityUserField();
            if (city) {
                const valueId = cityUserField.values.find(value => value.VALUE.toString().toLowerCase() === city.toString().toLowerCase()).ID;
                if (valueId) {
                    crmProducts = await this.getCrmProducts(valueId, cityUserField.key);
                }
            } else {
                crmProducts = await this.getCrmProducts();
            }

            crmProducts.forEach((product) => {
                data.push({
                    ID: product.ID.toString(),
                    NAME: product.NAME.toString(),
                    QUANTITY: 0,
                    SECTION_ID: product.SECTION_ID.toString(),
                    DESCRIPTION: product.DESCRIPTION ? product.DESCRIPTION : "Тут будет описание"
                });
            })
            return data;
        } catch (error) {
            logError("PRODUCTS SERVICE fetchProducts", error)
            return null;
        }
    }

    async fetchProductsFromId(startId, iblockId, city = null) {
        try {
            let data = [];
            let crmProducts = null;
            const cityUserField = await this.getCityUserField();
            if (city) {
                const valueId = cityUserField.values.find(value => value.VALUE.toString().toLowerCase() === city.toString().toLowerCase()).ID;
                if (valueId) {
                    crmProducts = await this.getCrmProductsFromId(startId, valueId, cityUserField.key);
                }
            } else {
                crmProducts = await this.getCrmProducts();
            }

            crmProducts.forEach((product) => {
                data.push({
                    ID: product.ID.toString(),
                    NAME: product.NAME.toString(),
                    QUANTITY: 0,
                    SECTION_ID: product.SECTION_ID.toString(),
                    DESCRIPTION: product.DESCRIPTION ? product.DESCRIPTION : "Тут будет описание"
                });
            })
            return data;
        } catch (error) {
            logError("PRODUCTS SERVICE fetchProducts", error)
            return null;
        }
    }

    async getCrmProductsFromId(startId, valueId = null, key = null) {
        let products = [];
        let start = 0;
        const batchSize = 50;
        let fetchedCount = 0;
        let total = 999999;

        try {
            while (fetchedCount < total) {
                let response = null;
                if (valueId && key && startId) {
                    response = await this.bx.call("crm.product.list", {
                        select: ["*"],
                        filter: {
                            ">ID": startId,
                            [key]: valueId
                        },
                        start: start
                    });
                } else {
                    response = await this.bx.call("crm.product.list", {
                        select: ["*"],
                        start: start
                    });
                }

                response?.result?.forEach(product => {
                    products.push( { "ID": product.ID, "NAME": product.NAME, "SECTION_ID": product.SECTION_ID, "DESCRIPTION": product.DESCRIPTION } )
                })

                if (!response.result || response.result.length === 0 || response.next === undefined) {
                    break; // Если больше нет товаров, завершаем цикл
                }
                fetchedCount += response.result.length;
                // Увеличиваем смещение для следующей порции товаров
                start += batchSize;
                total = response.total;
            }
            return products;
        } catch (error) {
            logError("PRODUCTS SERVICE getCrmProductsFromId", error);
            return null;
        }
    }

    async getCrmProducts(valueId = null, key= null) {
        let products = [];
        let start = 0;
        const batchSize = 50;
        let fetchedCount = 0;
        let total = 999999;

        try {
            while (fetchedCount < total) {
                let response = null;
                if (valueId && key) {
                    response = await this.bx.call("crm.product.list", {
                        select: ["*"],
                        filter: {
                            [key]: valueId
                        },
                        start: start
                    });
                } else {
                    response = await this.bx.call("crm.product.list", {
                        select: ["*"],
                        start: start
                    });
                }

                response?.result?.forEach(product => {
                    products.push( { "ID": product.ID, "NAME": product.NAME, "SECTION_ID": product.SECTION_ID, "DESCRIPTION": product.DESCRIPTION } )
                })

                if (!response.result || response.result.length === 0 || response.next === undefined) {
                    break; // Если больше нет товаров, завершаем цикл
                }
                fetchedCount += response.result.length;
                // Увеличиваем смещение для следующей порции товаров
                start += batchSize;
                total = response.total;
            }
            return products;
        } catch (error) {
            logError("PRODUCTS SERVICE getCrmProducts", error);
            return null;
        }
    }

    async getCrmProduct(productId) {
        try {
            return new Promise(async (resolve, reject) => {
                const product = (await this.bx.call("crm.product.get", {id: productId})).result;
                resolve(product)
            })
        } catch (error) {
            logError("PRODUCTS SERVICE getCrmProducts", error);
            return null;
        }
    }

    async getCrmProductsWithDetails(products) {
        try {
            const promises = await products.map(async product => {
                return (await this.bx.call("crm.product.get", {id: product.ID})).result;
            })

            return await Promise.all(promises);
        } catch (error) {
            logError("PRODUCTS SERVICE getCrmProductsWithDetails", error);
            return null;
        }
    }

    async fetchOffers(iblockId) {
        let offers = [];
        let fetchedCount = 0;
        let start = 0;
        const batchSize = 50;
        let total = 999999;

        try {
            while (fetchedCount < total) {
                const response = await this.bx.call("catalog.product.offer.list", {
                    select: ["id", "iblockId", "parentId", "quantity"],
                    filter: { iblockId: iblockId },
                    start: start
                });
                if (!response.result || response.result.offers.length === 0) {
                    break; // Если больше нет предложений, завершаем цикл
                }

                offers = offers.concat(response.result.offers);
                fetchedCount += response.result.offers.length;
                // Увеличиваем смещение для следующей порции предложений
                start += batchSize;
                total = response.total;
            }

            return offers;
        } catch (error) {
            logError("PRODUCT SERVICE getOffers", error);
            return null;
        }
    }

    async fetchOffersFromId(startId, iblockId) {
        let offers = [];
        let fetchedCount = 0;
        let start = 0;
        const batchSize = 50;
        let total = 999999;

        try {
            while (fetchedCount < total) {
                const response = await this.bx.call("catalog.product.offer.list", {
                    select: ["id", "iblockId", "parentId", "quantity"],
                    filter: { iblockId: iblockId, ">parentId": startId },
                    start: start
                });
                if (!response.result || response.result.offers.length === 0) {
                    break; // Если больше нет предложений, завершаем цикл
                }

                offers = offers.concat(response.result.offers);
                fetchedCount += response.result.offers.length;
                // Увеличиваем смещение для следующей порции предложений
                start += batchSize;
                total = response.total;
            }

            return offers;
        } catch (error) {
            logError("PRODUCT SERVICE getOffers", error);
            return null;
        }
    }

    async getOffersCatalogId(iblocks) {
        try {
            const offersCatalogIdArray = await Promise.all(iblocks.map(async (iblock) => {
                const result = await this.bx.call("catalog.catalog.isOffers", { id: iblock.id });
                if (result.result) {
                    return iblock.id;
                }
                return null;
            }));

            // Фильтруем null значения, чтобы получить только действительные ID инфоблоков
            const offersCatalogId = offersCatalogIdArray.filter(id => id !== null);

            // Если нужно вернуть только первый найденный ID
            return offersCatalogId.length > 0 ? offersCatalogId[0] : null;
        } catch (error) {
            logError("PRODUCT SERVICE getOffersCatalogId", error)
            return null;
        }

    }

    async getIblocksList() {
        try {
            return (await this.bx.call("catalog.catalog.list", {
                select: ["*"]
            })).result.catalogs;
        } catch (error) {
            logError("PRODUCT SERVICE getIblocksList", error);
            return null;
        }
    }

    async getQuantities() {
        try {
            // catalog.storeproduct.list
            return (await this.bx.call("catalog.storeproduct.list", {
                select: ["*"],
                filter: { storeId: 2 }
            })).result.storeProducts;
        } catch (error) {
            logError("PRODUCT SERVICE getIblocksList", error);
            return null;
        }
    }

    async getPictures(productId) {
        try {
            return (await this.bx.call("catalog.productImage.list", {
                productId: productId
            }).catch(error => logError("PRODUCT SERVICE getPictures catalog.productImage.list", error))).result.productImages;
        } catch (error) {
            logError("PRODUCT SERVICE getPictures", error);
            return null;
        }
    }

    async getSections() {
        try {
            return (await this.bx.call("crm.productsection.list",
                {
                    select: ["ID", "CATALOG_ID", "NAME"]
                }
            )).result;
        } catch (error) {
            logError("PRODUCT SERVICE getSections", error);
            return null;
        }
    }

    async getCityUserField() {
        try {
            const res = (await this.bx.call("crm.product.fields")).result;
            for (let key in res) {
                if (res.hasOwnProperty(key) && res[key].title.toString().toLowerCase() === "город") {
                    let values = [];
                    for (let k in res[key].values) {
                        if (res[key].values.hasOwnProperty(k)) {
                            values.push(res[key].values[k]);
                        }
                    }
                    return {key: key, values: values};
                }
            }
        } catch (error) {
            logError("PRODUCT SERVICE getCityUserField", error)
            return null;
        }
    }
}



module.exports= { ProductsService };