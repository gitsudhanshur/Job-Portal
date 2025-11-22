// Imports FROM firebase.js
import { auth, db } from "./firebase.js";

// Auth imports
import { 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword,
  signOut, 
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/9.22.2/firebase-auth.js";

// Firestore imports
import { 
  doc, setDoc, getDoc, addDoc, getDocs,
  collection, query, where, orderBy,
  updateDoc, arrayUnion
} from "https://www.gstatic.com/firebasejs/9.22.2/firebase-firestore.js";


/* ---------------------- SIGNUP ----------------------- */
async function signup() {
  const name = document.getElementById("name").value;
  const email = document.getElementById("email").value;
  const password = document.getElementById("password").value;
  const role = document.getElementById("role").value;

  try {
    const cred = await createUserWithEmailAndPassword(auth, email, password);
    await setDoc(doc(db, "users", cred.user.uid), { 
      uid: cred.user.uid,
      name,
      email,
      role
    });
    alert("Signup successful!");
    window.location = "dashboard.html";
  } catch (err) {
    alert(err.message);
  }
}


/* ---------------------- LOGIN ----------------------- */
async function login() {
  const email = document.getElementById("email").value;
  const password = document.getElementById("password").value;

  try {
    await signInWithEmailAndPassword(auth, email, password);
    window.location = "dashboard.html";
  } catch (err) {
    alert(err.message);
  }
}


/* ---------------------- LOGOUT ----------------------- */
async function logout() {
  await signOut(auth);
  window.location = "index.html";
}


/* ---------------------- POST JOB (Recruiter) ----------------------- */
async function postJob() {
  const title = document.getElementById("jobTitle").value;
  const company = document.getElementById("company").value;
  const location = document.getElementById("location").value;

  const user = auth.currentUser;

  if (user) {
    await addDoc(collection(db, "jobs"), {
      title, company, location,
      recruiterId: user.uid,
      applicants: [],
      createdAt: new Date()
    });
    alert("Job Posted!");
  }
}


/* ---------------------- PDF → Base64 Converter ----------------------- */
function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}


/* ---------------------- RESUME UPLOAD (Base64) ----------------------- */
window.uploadResumeForJob = async function(jobId) {
  const fileInput = document.getElementById(`resume-${jobId}`);
  const file = fileInput.files[0];

  if (!file) {
    alert("Select a resume file first!");
    return;
  }

  if (file.type !== "application/pdf") {
    alert("Only PDF allowed!");
    return;
  }

  const user = auth.currentUser;

  // Convert to Base64
  const base64 = await fileToBase64(file);

  // Save inside Firestore
  await addDoc(collection(db, "applications"), {
    jobId,
    seekerId: user.uid,
    resumeBase64: base64,
    appliedAt: new Date()
  });

  // Update UI
  const uploadBtn = document.getElementById(`uploadBtn-${jobId}`);
  uploadBtn.innerText = "Uploaded ✓";
  uploadBtn.style.background = "green";
  uploadBtn.style.color = "white";
  uploadBtn.disabled = true;

  document.getElementById(`applyBtn-${jobId}`).disabled = false;

  document.getElementById(`resume-status-${jobId}`).textContent =
    "Resume Uploaded Successfully!";
};


/* ---------------------- LOAD & RENDER JOBS ----------------------- */
let allJobs = [];

async function loadJobs() {
  const jobList = document.getElementById("jobList");
  const user = auth.currentUser;

  if (jobList && user) {
    const q = query(collection(db, "jobs"), orderBy("createdAt", "desc"));
    const snapshot = await getDocs(q);

    allJobs = snapshot.docs.map(docSnap => ({
      id: docSnap.id,
      ...docSnap.data()
    }));

    populateFilters(allJobs);
    renderJobs(allJobs, user.uid);
  }
}


/* ---------------------- RENDER JOB CARDS ----------------------- */
function renderJobs(jobs, uid) {
  const jobList = document.getElementById("jobList");
  jobList.innerHTML = "";

  jobs.forEach(job => {
    jobList.innerHTML += `
      <div class="job-card" id="job-${job.id}">
        <h3>${job.title}</h3>
        <p><strong>Company:</strong> ${job.company}</p>
        <p><strong>Location:</strong> ${job.location}</p>

        <input type="file" id="resume-${job.id}" accept="application/pdf" />

        <button id="uploadBtn-${job.id}" onclick="uploadResumeForJob('${job.id}')">
          Upload Resume
        </button>

        <button 
          id="applyBtn-${job.id}"
          onclick="applyJob('${job.id}')"
          ${job.applicants?.includes(uid) ? "disabled" : ""}
          style="${job.applicants?.includes(uid) ? "background:green;color:white;" : ""}"
        >
          ${job.applicants?.includes(uid) ? "Applied ✓" : "Apply"}
        </button>

        <p id="resume-status-${job.id}" style="color:green; font-size:14px;"></p>
      </div>
    `;
  });

  if (jobs.length === 0) jobList.innerHTML = "<p>No jobs found.</p>";
}


/* ---------------------- SEARCH & FILTER ----------------------- */
function populateFilters(jobs) {
  const locationFilter = document.getElementById("locationFilter");
  const roleFilter = document.getElementById("roleFilter");

  const locations = [...new Set(jobs.map(j => j.location))];
  locationFilter.innerHTML = `<option value="">All Locations</option>`;
  locations.forEach(loc => {
    locationFilter.innerHTML += `<option value="${loc}">${loc}</option>`;
  });

  const roles = [...new Set(jobs.map(j => j.title))];
  roleFilter.innerHTML = `<option value="">All Roles</option>`;
  roles.forEach(r => {
    roleFilter.innerHTML += `<option value="${r}">${r}</option>`;
  });
}

function applyFilters() {
  const keyword = document.getElementById("searchInput").value.toLowerCase();
  const selectedLocation = document.getElementById("locationFilter").value;
  const selectedRole = document.getElementById("roleFilter").value;

  let filteredJobs = allJobs.filter(job =>
    (job.title.toLowerCase().includes(keyword) || job.company.toLowerCase().includes(keyword)) &&
    (selectedLocation === "" || job.location === selectedLocation) &&
    (selectedRole === "" || job.title === selectedRole)
  );

  renderJobs(filteredJobs, auth.currentUser?.uid);
}

document.addEventListener("input", (e) => {
  if (e.target.id === "searchInput") applyFilters();
});

document.addEventListener("change", (e) => {
  if (e.target.id === "locationFilter" || e.target.id === "roleFilter") {
    applyFilters();
  }
});


/* ---------------------- APPLY JOB ----------------------- */
window.applyJob = async function(jobId) {
  const user = auth.currentUser;

  // Check whether resume is uploaded
  const q = query(
    collection(db, "applications"),
    where("jobId", "==", jobId),
    where("seekerId", "==", user.uid)
  );

  const snap = await getDocs(q);

  if (snap.empty) {
    alert("Upload resume first!");
    return;
  }

  // Update Firestore
  await updateDoc(doc(db, "jobs", jobId), {
    applicants: arrayUnion(user.uid)
  });

  // Update UI
  const applyBtn = document.getElementById(`applyBtn-${jobId}`);
  applyBtn.innerText = "Applied ✓";
  applyBtn.style.background = "green";
  applyBtn.style.color = "white";
  applyBtn.disabled = true;

  alert("Applied Successfully!");
};


/* ---------------------- LOAD APPLICANTS (Recruiter) ----------------------- */
async function loadApplicants() {
  const applicantsList = document.getElementById("applicantsList");
  const user = auth.currentUser;

  if (user) {
    const q = query(collection(db, "jobs"), orderBy("createdAt", "desc"));
    const snapshot = await getDocs(q);

    applicantsList.innerHTML = "";

    for (let docSnap of snapshot.docs) {
      const job = docSnap.data();
      const jobId = docSnap.id;

      if (job.recruiterId === user.uid) {
        applicantsList.innerHTML += `
          <div class="job-card">
            <h3>${job.title}</h3>
            <p><strong>Company:</strong> ${job.company}</p>
            <p><strong>Location:</strong> ${job.location}</p>
            <p><strong>Total Applicants:</strong> ${job.applicants?.length || 0}</p>
            <button onclick="viewApplicants('${jobId}')">View Applicants</button>
            <div id="applicants-${jobId}" class="applicants-list" style="display:none;"></div>
          </div>
        `;
      }
    }
  }
}


/* ---------------------- VIEW APPLICANTS (Recruiter) ----------------------- */
window.viewApplicants = async function(jobId) {
  const container = document.getElementById(`applicants-${jobId}`);
  if (!container) return;

  container.innerHTML = "<p>Loading...</p>";

  try {
    const q = query(
      collection(db, "applications"),
      where("jobId", "==", jobId)
    );

    const snap = await getDocs(q);

    if (snap.empty) {
      container.innerHTML = "<p>No applicants yet.</p>";
    } else {
      container.innerHTML = "<h4>Applicants:</h4>";

      for (let docSnap of snap.docs) {
        const app = docSnap.data();

        const userSnap = await getDoc(doc(db, "users", app.seekerId));
        const userData = userSnap.data();

        container.innerHTML += `
          <div class="applicant-card">
            <p><strong>Name:</strong> ${userData?.name || "Unknown"}</p>
            <p><strong>Email:</strong> ${userData?.email || "No Email"}</p>
            <a href="${app.resumeBase64}" download="resume.pdf" target="_blank">
              Download Resume
            </a>
          </div>
        `;
      }
    }

    container.style.display =
      container.style.display === "none" ? "block" : "none";

  } catch (err) {
    console.error("Error loading applicants:", err);
    container.innerHTML = "<p>Error loading applicants.</p>";
  }
};


/* ---------------------- ROLE-BASED DASHBOARD ----------------------- */
onAuthStateChanged(auth, async (user) => {
  if (user) {
    const userDoc = await getDoc(doc(db, "users", user.uid));

    if (userDoc.exists()) {
      const role = userDoc.data().role;

      document.getElementById("logoutBtn").onclick = logout;

      if (role === "recruiter") {
        document.getElementById("recruiterPanel").style.display = "block";
        document.getElementById("postJobBtn").onclick = postJob;
        loadApplicants();
      } 
      else {
        document.getElementById("seekerPanel").style.display = "block";
        loadJobs();
      }
    }
  }
});


/* ---------------------- INDEX PAGE EVENTS ----------------------- */
if (document.getElementById("signupBtn")) {
  document.getElementById("signupBtn").onclick = signup;
  document.getElementById("loginBtn").onclick = login;
}
