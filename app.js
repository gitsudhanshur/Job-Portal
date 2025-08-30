import { auth, db } from "./firebase.js";
import { 
  createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, onAuthStateChanged 
} from "https://www.gstatic.com/firebasejs/9.22.2/firebase-auth.js";
import { 
  doc, setDoc, getDoc, addDoc, getDocs, collection, query, orderBy, updateDoc, arrayUnion 
} from "https://www.gstatic.com/firebasejs/9.22.2/firebase-firestore.js";

// Signup
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

// Login
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

// Logout
async function logout() {
  await signOut(auth);
  window.location = "index.html";
}

// Recruiter - Post Job
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

let allJobs = []; // store all jobs for search & filter

// Seeker - Load Jobs with cards
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

    // Populate filters
    populateFilters(allJobs);

    // Initial render
    renderJobs(allJobs, user.uid);
  }
}

// Render jobs (after filters applied)
function renderJobs(jobs, uid) {
  const jobList = document.getElementById("jobList");
  jobList.innerHTML = "";

  jobs.forEach(job => {
    const alreadyApplied = job.applicants?.includes(uid);

    jobList.innerHTML += `
      <div class="job-card">
        <h3>${job.title}</h3>
        <p><strong>Company:</strong> ${job.company}</p>
        <p><strong>Location:</strong> ${job.location}</p>
        <button 
          onclick="applyJob('${job.id}')" 
          ${alreadyApplied ? "disabled" : ""}>
          ${alreadyApplied ? "Applied" : "Apply"}
        </button>
      </div>
    `;
  });

  if (jobs.length === 0) {
    jobList.innerHTML = "<p>No matching jobs found.</p>";
  }
}

// Populate location & role filters dynamically
function populateFilters(jobs) {
  const locationFilter = document.getElementById("locationFilter");
  const roleFilter = document.getElementById("roleFilter");

  // Unique locations
  const locations = [...new Set(jobs.map(job => job.location))];
  locationFilter.innerHTML = `<option value="">All Locations</option>`;
  locations.forEach(loc => {
    locationFilter.innerHTML += `<option value="${loc}">${loc}</option>`;
  });

  // Unique roles (from job titles)
  const roles = [...new Set(jobs.map(job => job.title))];
  roleFilter.innerHTML = `<option value="">All Roles</option>`;
  roles.forEach(r => {
    roleFilter.innerHTML += `<option value="${r}">${r}</option>`;
  });
}

// Apply search & filters
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

// Event listeners
document.addEventListener("input", (e) => {
  if (e.target.id === "searchInput") {
    applyFilters();
  }
});

document.addEventListener("change", (e) => {
  if (e.target.id === "locationFilter" || e.target.id === "roleFilter") {
    applyFilters();
  }
});

// Seeker - Apply Job
window.applyJob = async function(jobId) {
  const user = auth.currentUser;
  if (user) {
    const jobRef = doc(db, "jobs", jobId);
    await updateDoc(jobRef, {
      applicants: arrayUnion(user.uid)
    });
    alert("Applied Successfully!");
    loadJobs(); // refresh job list to update button state
  }
}

// Recruiter - Load Applicants with cards
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

// Recruiter - View Applicants for a specific job
window.viewApplicants = async function(jobId) {
  const jobRef = doc(db, "jobs", jobId);
  const jobSnap = await getDoc(jobRef);

  if (jobSnap.exists()) {
    const job = jobSnap.data();
    const applicantsDiv = document.getElementById(`applicants-${jobId}`);

    if (job.applicants && job.applicants.length > 0) {
      applicantsDiv.innerHTML = "<h4>Applicants:</h4>";
      for (let uid of job.applicants) {
        const userSnap = await getDoc(doc(db, "users", uid));
        let email = "Not available";
        let name = "Not available";

        if (userSnap.exists()) {
          const userData = userSnap.data();
          email = userData.email || "Not available";
          name = userData.name || "Not available";
        }

        applicantsDiv.innerHTML += `
          <div class="applicant-card">
            <p><strong>Name:</strong> ${name}</p>
            <p><strong>Email:</strong> ${email}</p>
          </div>
        `;
      }
    } else {
      applicantsDiv.innerHTML = "<p>No applicants yet.</p>";
    }

    applicantsDiv.style.display = 
      applicantsDiv.style.display === "none" ? "block" : "none";
  }
};

// Role-based dashboard
onAuthStateChanged(auth, async (user) => {
  if (user) {
    const userDoc = await getDoc(doc(db, "users", user.uid));
    if (userDoc.exists()) {
      const role = userDoc.data().role;
      if (document.getElementById("recruiterPanel")) {
        if (role === "recruiter") {
          document.getElementById("recruiterPanel").style.display = "block";
          document.getElementById("postJobBtn").onclick = postJob;
          loadApplicants();
        } else {
          document.getElementById("seekerPanel").style.display = "block";
          loadJobs();
        }
        document.getElementById("logoutBtn").onclick = logout;
      }
    }
  }
});

// Attach auth events on index.html
if (document.getElementById("signupBtn")) {
  document.getElementById("signupBtn").onclick = signup;
  document.getElementById("loginBtn").onclick = login;
}
