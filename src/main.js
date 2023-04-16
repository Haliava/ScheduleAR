import {
    clientForDeletion,
    createAutocompleteListElement,
    createLoadingForClientsTable,
    createLoadingForSaveButtons,
    createModalNewClient,
    createTable,
    setModalNameFields,
    displayErrorList,
    removeLoadingForSaveButtons
} from "./view.js";

import html2canvas from 'html2canvas';

let selectedAutocompleteOptionNumber = -1;
let autocompleteMAX = 10;
let mainContainer = document.getElementById("main-container");
let loadingTable = createLoadingForClientsTable();
mainContainer.append(loadingTable);

export let customerData = await (await fetch("http://localhost:3000/api/clients")).json();
let filteredCustomers = customerData.length > 0 ? [...customerData]: [];

loadingTable.remove();

let idToCustomerDict = {};
for (const customer of customerData)
    idToCustomerDict[customer.id] = [customer.id, customer.contacts, customer.name];


// Разные виды сортировок табличных записей
let idSort = (a, b) => {
    return (a.id < b.id) - (a.id > b.id);
}

let nameSort = (a, b) => {
    a = a.name;
    b = b.name;
    return (a < b) - (a > b);
}

let createdAtSort = (a, b) => {
    a = new Date(a.createdAt);
    b = new Date(b.createdAt);
    return (a < b) - (a > b);
}

let modifiedAtSort = (a, b) => {
    a = new Date(a.updatedAt);
    b = new Date(b.updatedAt);
    return (a < b) - (a > b);
}

let sorts = {
    "arrow-sort-by-id": idSort,
    "arrow-sort-by-name": nameSort,
    "arrow-sort-by-creation": createdAtSort,
    "arrow-sort-by-modification": modifiedAtSort
}

let validators = {
    "Телефон": (number) => number.match(/\+?[0-9]{11}/gi),
    "Доп. Телефон": (number) => number.match(/\+?[0-9]{11}/gi),
    "Email": (text) => text.match(/[a-zA-Z0-9]+@\w+\.\w+/gi),
}

export let DELETE_LISTENER = (id) => {
    fetch(`http://localhost:3000/api/clients/${id}`, {
        method: "DELETE",
    });
}

export let PATCH_LISTENER = (id) => {
    document.querySelectorAll(".dropdown").forEach(elem => {
        let contactName = elem.children[0].textContent;
        let currentValue = elem.nextSibling.value;
        if (Object.keys(validators).includes(contactName)) {
            if (validators[contactName](currentValue) === null)
                elem.nextSibling.style.background = "rgb(241,113,85, 0.2)";
            else
                elem.nextSibling.style.background = "";
        }
    });

    let name = document.getElementById("modal-name").value;
    let contactList = document.getElementById("modal-contact-grid-container").children;
    let contacts = [];

    let currentType = null;
    for (const child of contactList) {
        if (child.tagName.toLowerCase() === "div") {
            currentType = child.children[0].children[0].textContent; // костыльно, но работает
        } else if (child.tagName.toLowerCase() === "input" && currentType) {
            contacts.push({'type': currentType, 'value': child.value});
            currentType = null;
        }
    }

    fetch(`http://localhost:3000/api/clients/${id}`, {
        method: "PATCH",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify({
            name,
            contacts
        })
    })
        .then((response) => {
            if (response.status !== 200) {
                Promise.reject(response.json())
                    .catch(contentJson => contentJson.then(content => {
                        displayErrorList(content);
                        removeLoadingForSaveButtons(document.getElementById("modal-form-submit"));
                    }));
            } else {
                location.hash = "";
                location.reload();
            }
        });
};

/**
 * Преобразует дату и время, полученные из API в более удобный вид:
 * "2022-12-04" -> "04.12.2022"
 * "20:48:10.680Z" -> "20:48"
 */
function getDateAndTimeFromApi(elem) {
    return [
        elem[0].split("-").reverse().join("."),  // Date
        elem[1].split(":").slice(0, 2).join(":") // Time
    ];
}

async function generatePage() {
    setEventListeners();

    createTable(customerData);
    createModalNewClient();

    openModalFromHash();
}

/**
 * Записывает данные об одном клиенте из модального окна в arrTo в виде,
 * в котором получаются данные из API
 */
function saveDataFromModal() {
    let arrTo = {};

    arrTo.name = document.getElementById("modal-name").value;
    arrTo.contacts = [];

    let types = document.getElementsByClassName("current-contact-span");
    let data = document.getElementsByClassName("modal__contact-redact-input__data");

    for (let i = 0; i < types.length; i++) {
        arrTo.contacts.push(
            {"type": types[i].textContent, "value": data[i].value}
        );
    }

    return arrTo;
}

/**
 * Показывает клиентов, которые совпадвют с данными из поисковой строки
 * @param input - строка, записанная в header-input
 */
function displaySearchResult(input) {
    if (input.length <= 0) {
        filteredCustomers = customerData;
        document.querySelectorAll(".table__item").forEach(elem => elem.remove());
        createTable(customerData);

        return;
    }

    let foundCustomers = customerData.filter(customer =>
        (customer.name).toLowerCase().includes(input.replaceAll(" ", "").toLowerCase())
    );
    filteredCustomers = foundCustomers;
    console.log(foundCustomers);

    document.querySelectorAll(".table__item").forEach(elem => elem.remove());
    createTable(foundCustomers);
}

/**
 * Инициализирует все eventListeners страницы
 */
function setEventListeners() {
    let errorsDiv = document.getElementById("modal-errors");
    let foundCustomers = [...customerData];
    let formInputFields;
    let tmpLi;

    let autoList = document.getElementById("autocomplete-list");
    let input = document.getElementById("header-input");

    let timer;
    let throttleTimerHandler = () => {
        displaySearchResult(input.value);
    };

    document.getElementById("header-input").addEventListener("input", () => {
        if (!timer)
            timer = setTimeout(throttleTimerHandler, 300);

        clearTimeout(timer);
        timer = setTimeout(throttleTimerHandler, 300);

        autoList.innerHTML = "";
        if (input.value.length <= 0) {
            selectedAutocompleteOptionNumber = -1;
            return;
        }

        foundCustomers = getFoundCustomers(input.value);
        for (let i = 0; i < Math.min(10, foundCustomers.length); i++) {
            tmpLi = createAutocompleteListElement(foundCustomers[i]);
            tmpLi.id = "auto-li-" + i;
            tmpLi.addEventListener("click", (e) => {
                // input.value = [foundCustomers[i].surname, foundCustomers[i].name,foundCustomers[i].lastName].join(" ");
                // input.value = [foundCustomers[i].surname, foundCustomers[i].name,foundCustomers[i].lastName].join(" ");
                input.value = foundCustomers[i];
                input.focus();
                throttleTimerHandler();
                autoList.innerHTML = "";
            });

            autoList.append(tmpLi);
        }
        autocompleteMAX = foundCustomers.length;
    });

    document.addEventListener("keydown", (e) => {
        if ((document.activeElement.tagName !== "LI" && document.activeElement.tagName !== "INPUT") ||
            document.activeElement.classList.contains("modal-form__item-input") ||
            document.activeElement.classList.contains("modal__contact-item"))
            return;

        let setInputValue = () => {
            let li = document.getElementById("auto-li-" + selectedAutocompleteOptionNumber);
            input.value = li.textContent;
            li.focus();
        };

        switch (e.key) {
            case "ArrowDown":
                e.preventDefault();
                if (selectedAutocompleteOptionNumber + 1 >= autocompleteMAX) return;

                ++selectedAutocompleteOptionNumber;
                setInputValue();
                break;

            case "ArrowUp":
                e.preventDefault();
                if (selectedAutocompleteOptionNumber - 1 < 0) return;

                --selectedAutocompleteOptionNumber;
                setInputValue();
                break;

            case "Backspace":
            case " ":
                if (document.activeElement.tagName)
                    selectedAutocompleteOptionNumber = -1;
                input.focus();
                break;

            case "Enter":
                displaySearchResult(input.value);
                autoList.innerHTML = "";
                input.focus();
                break;
        }
    });

    input.addEventListener("focusout", (e) => {
        console.log(document.activeElement.tagName);
    }); // не получилось реализовать закрытие меню автодополнения при клике вне UL

    document.addEventListener("cancel", () => {
        displaySearchResult("");
    });

    document.getElementById("header-form").addEventListener("submit", (e) => {
        e.preventDefault();
    });

    document.getElementById("add-client-button").addEventListener("click", () => {
        document.getElementById("modal-label").textContent = "Новый кабинет";
        document.getElementById("modal-contact-list").classList.add("small-padding");
        document.getElementById("modal-contact-grid-container").innerHTML = "";
        setModalNameFields("", "", "");

        document.getElementById("add-contact-button-modal").classList.add("small-padding");
    });

    document.getElementById("modal-delete-button").addEventListener("click", (e) => {
        DELETE_LISTENER(clientForDeletion);
        location.reload();
    });

    document.getElementById("modal-form-cancel").addEventListener("click", () => {
        errorsDiv.innerHTML = "";
        location.hash = "";
    });

    document.getElementById("close-modal").addEventListener("click", () => {
        errorsDiv.innerHTML = "";
        location.hash = "";
    });

    let addClientFromModal = document.getElementById("modal-form-submit");
    addClientFromModal.addEventListener("click", (e) => {
        e.preventDefault();

        createLoadingForSaveButtons(addClientFromModal);

        formInputFields = saveDataFromModal();

        let data = {};
        Object.entries(formInputFields).forEach((elem) => {
            let [k, v] = elem;
            if (v !== null) data[k] = v;
            else data[k] = null;
        });
        console.log(data, "123");

        addNewClient(data).then(response => {
            if (Math.floor(response.status / 100) !== 2) {
                response.json().then(content => displayErrorList(content));
            } else location.reload();
        });

        removeLoadingForSaveButtons(addClientFromModal);
    });

    let downloadFromModalButton = document.getElementById("download-modal-form");
    downloadFromModalButton.addEventListener("click", () => {
        html2canvas(document.getElementById("modal-contact-list")).then(canvas => {
            canvas.setAttribute("download",
                (document.getElementById("modal-name").value + ".png" || "default.png")
            );
            canvas.setAttribute("href", canvas.toDataURL("image/png").replace("image/png", "image/octet-stream"))
            canvas.click();
        });
    })

    for (const filterElem of Object.keys(sorts)) {
        let pElem = document.getElementById(filterElem);
        let arrow = pElem.children[pElem.children.length - 1].children[0];

        pElem.addEventListener("click", (e) => {
            for (const elem of document.getElementsByClassName("rotating-arrow")) {
                if (elem === arrow) continue;
                elem.style.transform = "";
            }
            arrow.style.transform = arrow.style.transform ? "" : "rotate(180deg)";

            sortCustomers(filterElem, filteredCustomers, !!arrow.style.transform); // если есть transform - по возрастанию, если нет - по убыванию
        });
    }
}

/**
 * Показывает кабинеты для autocomplete списка
 * @param input - текст, введённый в header-input
 * @returns {*[]} - массив имён подходящих кабинетов
 */
function getFoundCustomers(input) {
    filteredCustomers = [];
    let res = [];
    let wordCount = input.split(" ").length > 3 ? 3 : input.split(" ").length;
    let getName = (wordCount, customer) => {
        let nameArr = [customer.name].slice(0, wordCount);
        return nameArr.join(" ").toLowerCase();
    }

    for (const customer of customerData) {
        if (getName(wordCount, customer).includes(input.toLowerCase())) {
            res.push(getName(wordCount, customer));
            filteredCustomers.push(customer);
        }
    }


    if (res.length <= 0)
        for (const customer of customerData)
            if (getName(3, customer).includes(input.replaceAll(" ", "").toLowerCase()))
                res.push(getName(3, customer));

    if (filteredCustomers.length <= 0) filteredCustomers = [...customerData];

    return Array.from(new Set(res));
}

function sortCustomers(filterName, dataSortTarget, isReversed = false) {
    dataSortTarget.sort(sorts[filterName]);
    if (isReversed) dataSortTarget = dataSortTarget.reverse();

    for (let elem of document.querySelectorAll(".table__item"))
        elem.remove();

    createTable(dataSortTarget);
}

async function addNewClient({name, contacts}) {
    return await fetch("http://localhost:3000/api/clients", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify({
            name,
            contacts,
        }),
    });
}

function openModalFromHash() {
    if (document.getElementById("staticBackdrop").classList.contains("show"))
        return;

    document.getElementById("change_button-" + location.hash.split("=")[1]).click();
}

export {generatePage, getDateAndTimeFromApi}