const missionMap = document.querySelector(".mission-map");
const hero = document.querySelector("#home");
const header = document.querySelector(".site-header");
const sectionLinks = [...document.querySelectorAll("[data-section-link]")];
const disclosureMenus = [
  ...document.querySelectorAll("details.mobile-menu, details.mission-map"),
];
const copyAddressButton = document.querySelector("[data-copy-address]");
const mintAddress = document.querySelector(".home-address");
const copyStatus = document.querySelector("[data-copy-status]");

const sectionIds = [
  "home",
  "journey",
  "dreams",
  "flight-status",
  "mission",
  "friends",
];
const trackedSections = sectionIds
  .map((id) => document.getElementById(id))
  .filter((section) => section !== null);

let updateQueued = false;

function updatePageState() {
  updateQueued = false;

  if (hero && missionMap && header) {
    const revealAfter = header.getBoundingClientRect().bottom;
    missionMap.classList.toggle(
      "is-visible",
      hero.getBoundingClientRect().bottom < revealAfter,
    );
  }

  const marker = window.innerHeight * 0.35;
  let currentSection = trackedSections[0];

  for (const section of trackedSections) {
    if (section.getBoundingClientRect().top <= marker) {
      currentSection = section;
    } else {
      break;
    }
  }

  for (const link of sectionLinks) {
    if (currentSection && link.getAttribute("href") === `#${currentSection.id}`) {
      link.setAttribute("aria-current", "location");
    } else {
      link.removeAttribute("aria-current");
    }
  }
}

function queuePageStateUpdate() {
  if (!updateQueued) {
    updateQueued = true;
    window.requestAnimationFrame(updatePageState);
  }
}

window.addEventListener("scroll", queuePageStateUpdate, { passive: true });
window.addEventListener("resize", queuePageStateUpdate);
window.addEventListener("load", queuePageStateUpdate, { once: true });
updatePageState();

for (const menu of disclosureMenus) {
  menu.addEventListener("click", (event) => {
    if (event.target instanceof Element && event.target.closest("a")) {
      menu.open = false;
    }
  });
}

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    for (const menu of disclosureMenus) {
      if (menu.open) {
        menu.open = false;
        menu.querySelector("summary")?.focus();
      }
    }
  }
});

if (
  copyAddressButton instanceof HTMLButtonElement &&
  mintAddress instanceof HTMLElement &&
  copyStatus instanceof HTMLElement
) {
  copyAddressButton.addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(mintAddress.textContent.trim());
      copyStatus.textContent = "Address copied.";
    } catch (error) {
      copyStatus.textContent = "Unable to copy address. Please copy it manually.";
      console.error("Unable to copy the RayRay mint address.", error);
    }
  });
}
