const {Bitrix} = require("@2bad/bitrix")
const {logError} = require("../logger/logger");

class DealsService {
    bx = null;

    constructor(link) {
        this.bx = Bitrix(link);
    }

    async updateDealOpportunity(dealId, opportunity) {
        try {
            return (await this.bx.call("crm.deal.update",
                {
                    id: dealId,
                    fields: {
                        "OPPORTUNITY": parseFloat(opportunity),
                    }
                }
            )).result;
        } catch (error) {
            logError("DEALS SERVICE updateDealOpportunity", error);
            return null;
        }
    }

    async addProductsToDeal(dealId, products) {
        try {
            if (products) {
                const productRows = products.map(product => {
                    return {
                        "PRODUCT_ID": product.ID,
                        // "PRICE": product.price,
                        "QUANTITY": product.QUANTITY,
                        "STORE_ID": product.STORE_ID,
                    }
                });

                return (await this.bx.call("crm.deal.productrows.set",
                    {
                        id: dealId,
                        rows: productRows
                    }
                )).result;
            } else {
                return null;
            }
        } catch (error) {
            logError("DEALS SERVICE addProductsToDeal", error);
            return null;
        }
    }

    async createDeal(title, contact_id, dateFrom, dateTo, weddingDate, prepayment, postpayment) {
        try {
            const userFields = await this.getDealsUserFields();
            const weddingDateField = userFields.find(uf => uf.hasOwnProperty("Дата свадьбы"));
            const prepaymentField = userFields.find(uf => uf.hasOwnProperty("Сумма предоплаты"));
            const postpaymentField = userFields.find(uf => uf.hasOwnProperty("Постоплата"));

            const weddingDateFieldTitle = weddingDateField ? weddingDateField["Дата свадьбы"] : null;
            const prepaymentFieldTitle = prepaymentField ? prepaymentField["Сумма предоплаты"] : null;
            const postpaymentFieldTitle = postpaymentField ? postpaymentField["Постоплата"] : null;

            return (await this.bx.call("crm.deal.add",
                {
                    fields: {
                        "TITLE": title,
                        "CONTACT_ID": contact_id,
                        "BEGINDATE": date2str(new Date(dateFrom)),
                        "CLOSEDATE": date2str(new Date(dateTo)),
                        [weddingDateFieldTitle]: weddingDate,
                        [prepaymentFieldTitle]: prepayment,
                        [postpaymentFieldTitle]: postpayment,
                        "CATEGORY_ID": 0,
                    }
                }
            )).result;
        } catch (error) {
            logError("DEALS SERVICE createDeal", error);
            return null;
        }
    }

    async getDealsUserFields() {
        try {
            let data = [];
            const response = (await this.bx.call("crm.deal.fields")).result;
            for (let key in response) {
                if (response.hasOwnProperty(key)) {
                    if (response[key]?.listLabel?.toString() === "Постоплата" || response[key]?.formLabel?.toString() === "Постоплата" || response[key]?.filterLabel?.toString() === "Постоплата") {
                        data.push({"Постоплата": response[key].title})
                    }
                    if (response[key]?.listLabel?.toString() === "Сумма предоплаты" || response[key]?.formLabel?.toString() === "Сумма предоплаты" || response[key]?.filterLabel?.toString() === "Сумма предоплаты") {
                        data.push({"Сумма предоплаты": response[key].title})
                    }
                    if (response[key]?.listLabel?.toString() === "Дата свадьбы" || response[key]?.formLabel?.toString() === "Дата свадьбы" || response[key]?.filterLabel?.toString() === "Дата свадьбы") {
                        data.push({"Дата свадьбы": response[key].title})
                    }
                }
            }
            return data;
        } catch (error) {
            logError("DEALS SERVICE getDealsUserFields", error);
            return null;
        }
    }

    async getDealsWithProductrows() {
        try {
            // Fetch all deals
            const deals = await this.getAllDeals();
            const userFields = await this.getDealsUserFields();
            const weddingDateField = userFields.find(uf => uf.hasOwnProperty("Дата свадьбы"));

            const weddingDateFieldTitle = weddingDateField ? weddingDateField["Дата свадьбы"] : null;

            // Fetch product rows for each deal
            return await Promise.all(
                deals.map(async deal => {
                    const fullDealInf = (await this.bx.deals.get(deal.ID)).result;
                    const productRows = (await this.bx.call("crm.deal.productrows.get", {id: deal.ID})).result;
                    return {
                        id: fullDealInf.ID,
                        title: fullDealInf.TITLE,
                        stage_id: fullDealInf.STAGE_ID,
                        begin_date: fullDealInf.BEGINDATE,
                        close_date: fullDealInf.CLOSEDATE,
                        contact_id: fullDealInf.CONTACT_ID,
                        productRows: productRows, // Use consistent property name 'productRows',
                        wedding_date: fullDealInf[weddingDateFieldTitle]
                    };
                })
            );
        } catch (error) {
            logError("DEALS SERVICE getDealsWithProductrows", error);
            return null;
        }
    }

    async getAllDeals() {
        return new Promise(async (resolve, reject) => {
            const pageSize = 50; // Number of contacts to fetch per request
            let allDeals = []; // Array to store all contacts

            let start = 0;
            let total = 0;

            try {
                do {
                    const data = await this.bx.deals.list({
                        select: ["*"],
                        filter: {
                            "!=STAGE_ID": "PREPAYMENT_INVOICE"
                        }
                    })
                    if (data && data.result) {
                        allDeals = [...allDeals, ...data.result];
                        total = data.total;
                        start += pageSize;
                    } else {
                        break; // Exit the loop if no more data or unexpected response structure
                    }

                } while(start < total);

                resolve(allDeals);
            } catch (error) {
                logError("DEALS SERVICE getAllDealsService", error);
                reject(null);
            }
        })
    }

}

var date2str = function(d)
{
    return d.getFullYear() + '-' + paddatepart(1 + d.getMonth()) + '-' + paddatepart(d.getDate()) + 'T' + paddatepart(d.getHours()) + ':' + paddatepart(d.getMinutes()) + ':' + paddatepart(d.getSeconds()) + '+03:00';
};
var paddatepart = function(part)
{
    return part >= 10 ? part.toString() : '0' + part.toString();
};

module.exports = { DealsService }