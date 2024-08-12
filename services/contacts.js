const {Bitrix} = require("@2bad/bitrix")
const {logError} = require("../logger/logger");

class ContactsService {
    bx = null;

    constructor(link) {
        this.bx = Bitrix(link);
    }

    async getAllContacts() {
        try {
            let contacts = [];
            let start = 0;
            const batchSize = 50;

            while (true) {
                const response = await this.bx.contacts.list({select: ["ID", "NAME", "LAST_NAME", "PHONE"]});
                response.result.forEach(contact => {
                    let phones = contact.PHONE?.map(phone => {
                        if (phone.TYPE_ID === "PHONE")
                            return phone.VALUE
                    })
                    contacts.push({
                        "ID": contact.ID,
                        "NAME": contact.NAME,
                        "LAST_NAME": contact.LAST_NAME,
                        "SECOND_NAME": contact.SECOND_NAME,
                        "PHONE": phones ? (phones[0] || null) : null,
                    });
                })
                if (!response.result || response.result.length === 0 || response.next === undefined) {
                    break; // Если больше нет товаров, завершаем цикл
                }
                // Увеличиваем смещение для следующей порции товаров
                start += batchSize;
            }

            return contacts;
        } catch (error) {
            logError("CONTACTS SERVICE getAllContacts", error);
            return null;
        }
    }

    async getAllContactsFromId(startId) {
        try {
            let contacts = [];
            let start = 0;
            const batchSize = 50;

            while (true) {
                const response = await this.bx.contacts.list({select: ["ID", "NAME", "LAST_NAME", "PHONE"], filter: { ">ID": startId }});
                response.result.forEach(contact => {
                    let phones = contact.PHONE?.map(phone => {
                        if (phone.TYPE_ID === "PHONE")
                            return phone.VALUE
                    })
                    contacts.push({
                        "ID": contact.ID,
                        "NAME": contact.NAME,
                        "LAST_NAME": contact.LAST_NAME,
                        "SECOND_NAME": contact.SECOND_NAME,
                        "PHONE": phones ? (phones[0] || null) : null,
                    });
                })
                if (!response.result || response.result.length === 0 || response.next === undefined) {
                    break; // Если больше нет товаров, завершаем цикл
                }
                // Увеличиваем смещение для следующей порции товаров
                start += batchSize;
            }

            return contacts;
        } catch (error) {
            logError("CONTACTS SERVICE getAllContacts", error);
            return null;
        }
    }

    async createContact(name, lastName, phone) {
        try {
            return (await this.bx.call("crm.contact.add",
                {
                    fields: {
                        "NAME": name,
                        "LAST_NAME": lastName,
                        "PHONE": [{"VALUE": phone, "VALUE_TYPE": "PHONE"}]
                    }
                }
            )).result;
        } catch (error) {
            logError("CONTACTS SERVICE createContact", error);
            return null;
        }
    }
}

module.exports = { ContactsService };