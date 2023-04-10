let classList = ["IT-5", "IT-7"];
let placeholderImagePath = "src/placeholder.png";

function generateClassBlocks(blocksCount) {
    let container = document.getElementById("container");

    for (let i = 0; i < blocksCount; i++) {
        console.log(123 + i);
        let div = document.createElement("div");
        div.classList.add("col");

        let card = document.createElement("div");
        card.classList.add("card", "shadow-sm");

        let cardImg = document.createElement("img");
        cardImg.src = fileExists(`src/${blocksCount}.jpg`) ? `src/${blocksCount}.jpg`: placeholderImagePath;

        let cardBody = document.createElement("div");
        cardBody.classList.add("card-body");

        let classroomName = document.createElement("p");
        classroomName.textContent = `${i}`;

        let buttonDiv = document.createElement("div");
        buttonDiv.classList.add("d-flex", "justify-content-between", "align-items-center");

        let buttonView = document.createElement("button");
        buttonView.classList.add("btn", "btn-sm", "btn-outline-secondary");
        buttonView.textContent = "Подробнее";
        buttonView.addEventListener("click", (e) => {
           e.preventDefault();

           window.location.href = `/card${i}.html`;
        });

        buttonDiv.appendChild(buttonView);
        cardBody.appendChild(classroomName);
        cardBody.appendChild(buttonDiv);
        card.appendChild(cardImg);
        card.appendChild(cardBody);
        div.appendChild(card);
        container.appendChild(div);
    }
}

function fileExists(url) {
    let img = new Image();
    img.src = url;

    return img.height !== 0;
}

export {generateClassBlocks, fileExists}