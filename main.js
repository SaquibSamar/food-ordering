// Replace with your own Firebase config
const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_AUTH_DOMAIN",
  databaseURL: "YOUR_DB_URL",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_BUCKET",
  messagingSenderId: "YOUR_SENDER_ID",
  appId: "YOUR_APP_ID"
};
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();
let currentRole = null;

function showLogin(role) {
  currentRole = role;
  document.getElementById("login-form").innerHTML = `
    <form onsubmit="return doLogin(event)">
      <h2>${role === 'admin' ? "Admin" : "Customer"} Login</h2>
      <input id="email" type="email" required placeholder="Email"><br>
      <input id="password" type="password" required placeholder="Password"><br>
      <input type="submit" value="Login">
      <button onclick="showRegister(event)">Register</button>
    </form>
  `;
  document.getElementById("login-form").classList.remove("hide");
  document.getElementById("app").innerHTML = "";
}

function showRegister(event) {
  event.preventDefault();
  document.getElementById("login-form").innerHTML = `
    <form onsubmit="return doRegister(event)">
      <h2>Register as ${currentRole === 'admin' ? "Admin" : "Customer"}</h2>
      <input id="reg-email" type="email" required placeholder="Email"><br>
      <input id="reg-password" type="password" required placeholder="Password"><br>
      <input type="submit" value="Register">
      <button onclick="showLogin('${currentRole}')">Back to Login</button>
    </form>
  `;
}

async function doLogin(event) {
  event.preventDefault();
  const email = document.getElementById("email").value;
  const password = document.getElementById("password").value;
  try {
    await auth.signInWithEmailAndPassword(email, password);
    localStorage.setItem("role", currentRole);
    logAction("Login");
    renderApp();
  } catch (e) {
    alert("Login failed! " + e.message);
  }
  return false;
}
async function doRegister(event) {
  event.preventDefault();
  const email = document.getElementById("reg-email").value;
  const password = document.getElementById("reg-password").value;
  try {
    await auth.createUserWithEmailAndPassword(email, password);
    await db.collection("users").doc(auth.currentUser.uid).set({ role: currentRole });
    logAction("Registration");
    renderApp();
  } catch (e) {
    alert("Registration failed! " + e.message);
  }
  return false;
}

function logAction(action) {
  const user = auth.currentUser ? auth.currentUser.email : "Guest";
  db.collection("logs").add({
    user,
    role: currentRole,
    action,
    ts: new Date()
  });
}
function logout() {
  auth.signOut();
  localStorage.removeItem("role");
  document.getElementById("app").innerHTML = "";
  document.getElementById("login-form").classList.remove("hide");
}

auth.onAuthStateChanged(async function(user) {
  if (user) {
    // Get user role from DB or localStorage
    let role = localStorage.getItem("role");
    if (!role) {
      const snap = await db.collection("users").doc(user.uid).get();
      role = snap.exists ? snap.data().role : "customer";
      localStorage.setItem("role", role);
    }
    currentRole = role;
    renderApp();
  }
});

async function renderApp() {
  document.getElementById("login-form").classList.add("hide");
  document.getElementById("app").innerHTML = `
    <div>
      <span class="logout" onclick="logout()">Logout</span>
      <h2>Welcome, ${currentRole === 'admin' ? "Admin" : "Customer"}!</h2>
    </div>
  `;
  if (currentRole === "admin") renderAdminPanel();
  else renderCustomerPanel();
}

async function renderAdminPanel() {
  document.getElementById("app").innerHTML += `
    <div class="admin-section">
      <h3>Add Food Item</h3>
      <form onsubmit="return addFoodItem(event)">
        <input id="food-name" required placeholder="Food Name">
        <input id="food-price" required type="number" placeholder="Price">
        <button type="submit">Add</button>
      </form>
      <h3>Food Items</h3>
      <div id="food-list"></div>
    </div>
  `;
  listFoodItems();
}

async function addFoodItem(event) {
  event.preventDefault();
  const name = document.getElementById("food-name").value;
  const price = document.getElementById("food-price").value;
  await db.collection("food").add({ name, price });
  logAction("Added Food: " + name);
  listFoodItems();
  event.target.reset();
  return false;
}

async function listFoodItems() {
  const snap = await db.collection("food").get();
  const list = Array.from(snap.docs).map(doc =>
    `<div class="card">
      <span class="card-title">${doc.data().name}</span>
      <span class="card-price">₹${doc.data().price}</span>
    </div>`
  ).join("");
  document.getElementById("food-list").innerHTML = list;
}

async function renderCustomerPanel() {
  document.getElementById("app").innerHTML += `
    <h3>Available Food Items</h3>
    <div id="food-list"></div>
    <h3>My Cart</h3>
    <div id="cart"></div>
    <button onclick="placeOrder()">Place Order</button>
  `;
  listFoodItemsCustomer();
}

async function listFoodItemsCustomer() {
  const snap = await db.collection("food").get();
  const list = Array.from(snap.docs).map(doc =>
    `<div class="card">
      <span class="card-title">${doc.data().name}</span>
      <span class="card-price">₹${doc.data().price}</span>
      <button onclick="addToCart('${doc.id}', '${doc.data().name}', ${doc.data().price})">Add to Cart</button>
    </div>`
  ).join("");
  document.getElementById("food-list").innerHTML = list;
}

let cart = [];
function addToCart(id, name, price) {
  cart.push({ id, name, price });
  updateCart();
  logAction("Added to cart: " + name);
}
function updateCart() {
  document.getElementById("cart").innerHTML =
    cart.map(item =>
      `<div>${item.name} - ₹${item.price}</div>`
    ).join("");
}
async function placeOrder() {
  if (!cart.length) { alert("Cart is empty."); return; }
  await db.collection("orders").add({
    user: auth.currentUser.email,
    items: cart,
    ts: new Date()
  });
  logAction("Placed order");
  alert("Order placed!");
  cart = [];
  updateCart();
}
