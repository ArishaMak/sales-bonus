fetch("http://localhost:5000/api/sellers-stats")
  .then(r => r.json())
  .then(data => {
    console.log("Ответ от /api/sellers-stats:");
    console.log(JSON.stringify(data, null, 2));
  })
  .catch(err => console.error("Ошибка:", err));
