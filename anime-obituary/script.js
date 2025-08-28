const button = document.getElementById("fetch-btn");
const cardContainer = document.getElementById("character-card");

// Fungsi fetch karakter
async function fetchCharacter() {
  cardContainer.innerHTML = "<p>Loading...</p>";

  try {
    const response = await fetch("https://api.anime.wrdt.my.id/characters/random");
    if (!response.ok) throw new Error("Gagal mengambil data");

    const data = await response.json();

    cardContainer.innerHTML = `
      <div class="card">
        <img src="${data.image_url}" alt="${data.name}">
        <div class="card-content">
          <h2>${data.name}</h2>
          <p><strong>Anime:</strong> ${data.anime}</p>
          <p><strong>Lahir:</strong> ${data.birth_date}</p>
          <p><strong>Meninggal:</strong> ${data.death_date}</p>
          <p><strong>Penyebab:</strong> ${data.cause_of_death}</p>
          <p>${data.bio}</p>
        </div>
      </div>
    `;
  } catch (err) {
    cardContainer.innerHTML = `<p style="color:red;">Error: ${err.message}</p>`;
  }
}

// Fetch pertama kali saat halaman load
window.addEventListener("load", fetchCharacter);

// Refresh saat tombol ditekan
button.addEventListener("click", fetchCharacter);
