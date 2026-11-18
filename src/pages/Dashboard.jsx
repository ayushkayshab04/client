import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { onAuthStateChanged, signOut } from "firebase/auth";
import {
  addDoc,
  collection,
  onSnapshot,
  query,
  where,
  orderBy,
  serverTimestamp,
  doc,
  updateDoc,
  deleteDoc,
  getDocs,
  writeBatch,
} from "firebase/firestore";
import { auth, db } from "../firebase";
import ModelSelector from "../components/ModelSelector";
import AIChat from "../components/AIchat";

const inputClass = "w-full rounded-lg border p-3";
const buttonClass =
  "w-full rounded-lg bg-blue-600 p-3 font-semibold text-white disabled:opacity-50";

const SPECIES = ["Dog", "Cat", "Bird", "Rabbit", "Other"];

export default function Dashboard() {
  const navigate = useNavigate();

  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [pets, setPets] = useState([]);
  const [appointments, setAppointments] = useState([]);
  const [prescriptions, setPrescriptions] = useState([]);
  const [medicalRecords, setMedicalRecords] = useState([]);

  const [loading, setLoading] = useState(false);
  const [bookingLoading, setBookingLoading] = useState(false);
  const [deletingPetId, setDeletingPetId] = useState(null);
  const [error, setError] = useState("");

  const [petName, setPetName] = useState("");
  const [species, setSpecies] = useState("Dog");
  const [breed, setBreed] = useState("");
  const [age, setAge] = useState("");
  const [editingPet, setEditingPet] = useState(null);

  const [selectedPet, setSelectedPet] = useState("");
  const [appointmentDate, setAppointmentDate] = useState("");
  const [appointmentTime, setAppointmentTime] = useState("");
  const [reason, setReason] = useState("");

  const [prescriptionPet, setPrescriptionPet] = useState("");
  const [medicine, setMedicine] = useState("");
  const [dosage, setDosage] = useState("");
  const [instructions, setInstructions] = useState("");

  const [recordPet, setRecordPet] = useState("");
  const [recordTitle, setRecordTitle] = useState("");
  const [recordDetails, setRecordDetails] = useState("");
  const [selectedAIModel, setSelectedAIModel] = useState({
  provider: "openai",
  model: "",
});

  // Authentication
  useEffect(() => {
    return onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setAuthLoading(false);
      if (!currentUser) navigate("/login");
    });
  }, [navigate]);

  // Realtime Firestore data
  useEffect(() => {
    if (!user) return;

    const subscriptions = [
      ["pets", setPets],
      ["prescriptions", setPrescriptions],
      ["medicalRecords", setMedicalRecords],
    ].map(([name, setter]) =>
      onSnapshot(
        query(collection(db, name), where("ownerId", "==", user.uid)),
        (snapshot) =>
          setter(
            snapshot.docs.map((item) => ({
              id: item.id,
              ...item.data(),
            })),
          ),
        (err) => setError(err.message),
      ),
    );

    const appointmentsQuery = query(
      collection(db, "appointments"),
      where("ownerId", "==", user.uid),
      orderBy("date", "asc"),
    );

    subscriptions.push(
      onSnapshot(
        appointmentsQuery,
        (snapshot) =>
          setAppointments(
            snapshot.docs.map((item) => ({
              id: item.id,
              ...item.data(),
            })),
          ),
        (err) => setError(err.message),
      ),
    );

    return () => subscriptions.forEach((unsubscribe) => unsubscribe());
  }, [user]);

  // Add pet
  const handleAddPet = async (e) => {
    e.preventDefault();
    if (!user) return;

    setError("");
    setLoading(true);

    try {
      await addDoc(collection(db, "pets"), {
        ownerId: user.uid,
        name: petName.trim(),
        species,
        breed: breed.trim(),
        age: age ? Number(age) : null,
        createdAt: serverTimestamp(),
      });

      setPetName("");
      setSpecies("Dog");
      setBreed("");
      setAge("");
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Edit pet
  const handleEditPet = async (e) => {
    e.preventDefault();
    if (!editingPet || !user) return;

    setError("");
    setLoading(true);

    try {
      await updateDoc(doc(db, "pets", editingPet.id), {
        name: editingPet.name.trim(),
        species: editingPet.species,
        breed: editingPet.breed.trim(),
        age: editingPet.age === "" ? null : Number(editingPet.age),
      });

      setEditingPet(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Cascade delete: remove related records, then the pet
  const handleDeletePet = async (petId) => {
    const pet = pets.find((item) => item.id === petId);
    if (!pet || !user || deletingPetId) return;

    const confirmed = window.confirm(
      `Delete ${pet.name}? All associated appointments, prescriptions and medical history will also be permanently deleted.`,
    );

    if (!confirmed) return;

    setError("");
    setDeletingPetId(petId);

    try {
      const collectionsToClean = [
        "appointments",
        "prescriptions",
        "medicalRecords",
      ];

      const snapshots = await Promise.all(
        collectionsToClean.map((name) =>
          getDocs(
            query(collection(db, name), where("ownerId", "==", user.uid)),
          ),
        ),
      );

      const relatedDocuments = snapshots.flatMap((snapshot) =>
        snapshot.docs.filter((item) => item.data().petId === petId),
      );

      // Firestore batches support a maximum of 500 writes.
      // Use 450 to leave a safety margin.
      for (let i = 0; i < relatedDocuments.length; i += 450) {
        const batch = writeBatch(db);
        relatedDocuments.slice(i, i + 450).forEach((item) => {
          batch.delete(item.ref);
        });
        await batch.commit();
      }

      // Delete the pet only after its related records are removed.
      await deleteDoc(doc(db, "pets", petId));

      if (selectedPet === petId) setSelectedPet("");
      if (prescriptionPet === petId) setPrescriptionPet("");
      if (recordPet === petId) setRecordPet("");
      if (editingPet?.id === petId) setEditingPet(null);
    } catch (err) {
      console.error("Pet cascade deletion failed:", err);
      setError(
        `Could not completely delete the pet and its records: ${err.message}`,
      );
    } finally {
      setDeletingPetId(null);
    }
  };

  // Book appointment
  const handleBookAppointment = async (e) => {
    e.preventDefault();

    const pet = pets.find((item) => item.id === selectedPet);
    if (!user || !pet) {
      setError("Please select a pet.");
      return;
    }

    setError("");
    setBookingLoading(true);

    try {
      await addDoc(collection(db, "appointments"), {
        ownerId: user.uid,
        petId: pet.id,
        petName: pet.name,
        date: appointmentDate,
        time: appointmentTime,
        reason: reason.trim(),
        status: "Pending",
        createdAt: serverTimestamp(),
      });

      setSelectedPet("");
      setAppointmentDate("");
      setAppointmentTime("");
      setReason("");
    } catch (err) {
      setError(err.message);
    } finally {
      setBookingLoading(false);
    }
  };

  // Add prescription
  const handleAddPrescription = async (e) => {
    e.preventDefault();

    const pet = pets.find((item) => item.id === prescriptionPet);
    if (!user || !pet) return;

    setError("");

    try {
      await addDoc(collection(db, "prescriptions"), {
        ownerId: user.uid,
        petId: pet.id,
        petName: pet.name,
        medicine: medicine.trim(),
        dosage: dosage.trim(),
        instructions: instructions.trim(),
        createdAt: serverTimestamp(),
      });

      setMedicine("");
      setDosage("");
      setInstructions("");
      setPrescriptionPet("");
    } catch (err) {
      setError(err.message);
    }
  };

  // Add medical record
  const handleAddMedicalRecord = async (e) => {
    e.preventDefault();

    const pet = pets.find((item) => item.id === recordPet);
    if (!user || !pet) return;

    setError("");

    try {
      await addDoc(collection(db, "medicalRecords"), {
        ownerId: user.uid,
        petId: pet.id,
        petName: pet.name,
        title: recordTitle.trim(),
        details: recordDetails.trim(),
        createdAt: serverTimestamp(),
      });

      setRecordTitle("");
      setRecordDetails("");
      setRecordPet("");
    } catch (err) {
      setError(err.message);
    }
  };

  const handleLogout = async () => {
    await signOut(auth);
    navigate("/login");
  };

  if (authLoading) {
    return <div className="p-10">Loading...</div>;
  }

  return (
    <main className="min-h-screen bg-slate-100 p-6 md:p-10">
      <header className="mx-auto flex max-w-5xl items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">AI Vet</h1>
          <p className="mt-1 text-slate-600">
            Welcome, {user?.displayName || user?.email}
          </p>
        </div>

        <ModelSelector onModelChange={setSelectedAIModel} />

        <button
          onClick={handleLogout}
          className="rounded-lg border border-slate-300 bg-white px-4 py-2"
        >
          Log out
        </button>
      </header>

      <section className="mx-auto mt-8 grid max-w-5xl gap-6 md:grid-cols-2">
        {/* Add pet */}
        <div className="rounded-2xl bg-white p-6 shadow-sm">
          <h2 className="mb-5 text-xl font-bold">Add a pet</h2>

          <form onSubmit={handleAddPet} className="space-y-4">
            <input
              className={inputClass}
              placeholder="Pet name"
              value={petName}
              onChange={(e) => setPetName(e.target.value)}
              required
            />

            <select
              className={inputClass}
              value={species}
              onChange={(e) => setSpecies(e.target.value)}
            >
              {SPECIES.map((item) => (
                <option key={item}>{item}</option>
              ))}
            </select>

            <input
              className={inputClass}
              placeholder="Breed (optional)"
              value={breed}
              onChange={(e) => setBreed(e.target.value)}
            />

            <input
              className={inputClass}
              type="number"
              min="0"
              placeholder="Age in years (optional)"
              value={age}
              onChange={(e) => setAge(e.target.value)}
            />

            <button disabled={loading} className={buttonClass}>
              {loading ? "Adding pet..." : "Add pet"}
            </button>
          </form>
        </div>

        {/* My pets */}
        <div className="rounded-2xl bg-white p-6 shadow-sm">
          <h2 className="mb-5 text-xl font-bold">My pets ({pets.length})</h2>

          {pets.length === 0 ? (
            <p className="text-slate-500">No pets added yet.</p>
          ) : (
            <div className="space-y-3">
              {pets.map((pet) => (
                <div key={pet.id} className="rounded-lg border p-4">
                  <h3 className="font-semibold text-slate-900">{pet.name}</h3>

                  <p className="text-sm text-slate-600">
                    {pet.species} {pet.breed ? `· ${pet.breed}` : ""}
                    {pet.age != null ? ` · ${pet.age} years` : ""}
                  </p>

                  <div className="mt-3 flex gap-3">
                    <button
                      onClick={() =>
                        setEditingPet({
                          ...pet,
                          age: pet.age ?? "",
                          breed: pet.breed ?? "",
                        })
                      }
                      className="text-sm font-medium text-blue-600"
                    >
                      Edit
                    </button>

                    <button
                      onClick={() => handleDeletePet(pet.id)}
                      disabled={deletingPetId !== null}
                      className="text-sm font-medium text-red-600 disabled:opacity-50"
                    >
                      {deletingPetId === pet.id ? "Deleting..." : "Delete"}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Book appointment */}
        <div className="rounded-2xl bg-white p-6 shadow-sm">
          <h2 className="mb-5 text-xl font-bold">Book an appointment</h2>

          <form onSubmit={handleBookAppointment} className="space-y-4">
            <select
              className={inputClass}
              value={selectedPet}
              onChange={(e) => setSelectedPet(e.target.value)}
              required
            >
              <option value="">Select your pet</option>
              {pets.map((pet) => (
                <option key={pet.id} value={pet.id}>
                  {pet.name}
                </option>
              ))}
            </select>

            <input
              type="date"
              className={inputClass}
              value={appointmentDate}
              onChange={(e) => setAppointmentDate(e.target.value)}
              min={new Date().toLocaleDateString("en-CA")}
              required
            />

            <input
              type="time"
              className={inputClass}
              value={appointmentTime}
              onChange={(e) => setAppointmentTime(e.target.value)}
              required
            />

            <textarea
              className={inputClass}
              placeholder="Reason for appointment"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              required
            />

            <button
              disabled={bookingLoading || pets.length === 0}
              className={buttonClass}
            >
              {bookingLoading ? "Booking..." : "Book appointment"}
            </button>
          </form>
        </div>
        <AIChat selectedAIModel={selectedAIModel} />


        {/* Appointments */}
        <div className="rounded-2xl bg-white p-6 shadow-sm">
          <h2 className="mb-5 text-xl font-bold">My appointments</h2>

          {appointments.length === 0 ? (
            <p className="text-slate-500">No appointments booked yet.</p>
          ) : (
            <div className="space-y-3">
              {appointments.map((item) => (
                <div key={item.id} className="rounded-lg border p-4">
                  <h3 className="font-semibold">{item.petName}</h3>
                  <p className="text-sm text-slate-600">
                    {item.date} at {item.time}
                  </p>
                  <p className="mt-1 text-sm">{item.reason}</p>
                  <p className="mt-2 text-sm font-medium text-blue-600">
                    Status: {item.status}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Prescriptions */}
        <div className="rounded-2xl bg-white p-6 shadow-sm">
          <h2 className="mb-5 text-xl font-bold">Prescriptions</h2>

          <form onSubmit={handleAddPrescription} className="space-y-3">
            <select
              className={inputClass}
              value={prescriptionPet}
              onChange={(e) => setPrescriptionPet(e.target.value)}
              required
            >
              <option value="">Select pet</option>
              {pets.map((pet) => (
                <option key={pet.id} value={pet.id}>
                  {pet.name}
                </option>
              ))}
            </select>

            <input
              className={inputClass}
              placeholder="Medicine name"
              value={medicine}
              onChange={(e) => setMedicine(e.target.value)}
              required
            />

            <input
              className={inputClass}
              placeholder="Dosage"
              value={dosage}
              onChange={(e) => setDosage(e.target.value)}
              required
            />

            <textarea
              className={inputClass}
              placeholder="Instructions"
              value={instructions}
              onChange={(e) => setInstructions(e.target.value)}
            />

            <button disabled={!pets.length} className={buttonClass}>
              Add prescription
            </button>
          </form>

          <div className="mt-6 space-y-3">
            {prescriptions.map((item) => (
              <div key={item.id} className="rounded-lg border p-4">
                <h3 className="font-semibold">
                  {item.petName} — {item.medicine}
                </h3>
                <p className="text-sm text-slate-600">Dosage: {item.dosage}</p>
                <p className="text-sm text-slate-600">{item.instructions}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Medical history */}
        <div className="rounded-2xl bg-white p-6 shadow-sm">
          <h2 className="mb-5 text-xl font-bold">Medical history</h2>

          <form onSubmit={handleAddMedicalRecord} className="space-y-3">
            <select
              className={inputClass}
              value={recordPet}
              onChange={(e) => setRecordPet(e.target.value)}
              required
            >
              <option value="">Select pet</option>
              {pets.map((pet) => (
                <option key={pet.id} value={pet.id}>
                  {pet.name}
                </option>
              ))}
            </select>

            <input
              className={inputClass}
              placeholder="Record title (e.g. Vaccination)"
              value={recordTitle}
              onChange={(e) => setRecordTitle(e.target.value)}
              required
            />

            <textarea
              className={inputClass}
              placeholder="Medical details"
              value={recordDetails}
              onChange={(e) => setRecordDetails(e.target.value)}
              required
            />

            <button disabled={!pets.length} className={buttonClass}>
              Add medical record
            </button>
          </form>

          <div className="mt-6 space-y-3">
            {medicalRecords.map((item) => (
              <div key={item.id} className="rounded-lg border p-4">
                <h3 className="font-semibold">
                  {item.petName} — {item.title}
                </h3>
                <p className="text-sm text-slate-600">{item.details}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Edit pet modal */}
        {editingPet && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
            <div className="relative w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
              <button
                type="button"
                onClick={() => setEditingPet(null)}
                className="absolute right-5 top-5 text-2xl text-slate-400 hover:text-slate-800"
                aria-label="Close"
              >
                &times;
              </button>

              <h2 className="mb-2 text-2xl font-bold text-slate-900">
                Edit pet
              </h2>
              <p className="mb-6 text-sm text-slate-500">
                Update your pet's information.
              </p>

              <form onSubmit={handleEditPet} className="space-y-4">
                <div>
                  <label className="mb-1 block text-sm font-medium">
                    Pet name
                  </label>
                  <input
                    className={inputClass}
                    value={editingPet.name}
                    onChange={(e) =>
                      setEditingPet({ ...editingPet, name: e.target.value })
                    }
                    required
                  />
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium">
                    Species
                  </label>
                  <select
                    className={inputClass}
                    value={editingPet.species}
                    onChange={(e) =>
                      setEditingPet({ ...editingPet, species: e.target.value })
                    }
                  >
                    {SPECIES.map((item) => (
                      <option key={item}>{item}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium">
                    Breed
                  </label>
                  <input
                    className={inputClass}
                    placeholder="Breed"
                    value={editingPet.breed}
                    onChange={(e) =>
                      setEditingPet({ ...editingPet, breed: e.target.value })
                    }
                  />
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium">
                    Age (years)
                  </label>
                  <input
                    className={inputClass}
                    type="number"
                    min="0"
                    placeholder="Age"
                    value={editingPet.age}
                    onChange={(e) =>
                      setEditingPet({ ...editingPet, age: e.target.value })
                    }
                  />
                </div>

                <div className="flex gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setEditingPet(null)}
                    className="w-1/2 rounded-lg border border-slate-300 p-3 font-medium"
                  >
                    Cancel
                  </button>

                  <button
                    disabled={loading}
                    className="w-1/2 rounded-lg bg-blue-600 p-3 font-semibold text-white disabled:opacity-60"
                  >
                    {loading ? "Saving..." : "Save changes"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </section>

      {error && (
        <p className="mx-auto mt-4 max-w-5xl text-sm text-red-600">{error}</p>
      )}
    </main>
  );
}
