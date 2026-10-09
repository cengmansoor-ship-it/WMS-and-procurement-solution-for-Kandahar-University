import { doc, getDoc, setDoc, updateDoc, collection, getDocs, query, limit } from "firebase/firestore";
import { db } from "./firebase";
import { ROLES, UserRole } from "../constants/roles";

export interface UserProfile {
  uid: string;
  name: string;
  email: string;
  phone: string;
  role: UserRole;
  active: boolean;
  forcePasswordChange: boolean;
  createdAt: number;
  updatedAt: number;
  person_id?: number;
  faculty_id?: number;
  department_id?: number;
}

const COLLECTION_NAME = "users";

export const isFirstUser = async (): Promise<boolean> => {
  try {
    const q = query(collection(db, COLLECTION_NAME), limit(1));
    const querySnapshot = await getDocs(q);
    return querySnapshot.empty;
  } catch (error) {
    console.error("Error checking first user:", error);
    return false;
  }
};

export const getUserProfile = async (uid: string): Promise<UserProfile | null> => {
  try {
    const docRef = doc(db, COLLECTION_NAME, uid);
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      return docSnap.data() as UserProfile;
    }
    return null;
  } catch (error) {
    console.error("Error getting user profile:", error);
    throw error;
  }
};

export const createUserProfile = async (profile: UserProfile): Promise<void> => {
  try {
    const docRef = doc(db, COLLECTION_NAME, profile.uid);
    await setDoc(docRef, profile);
  } catch (error) {
    console.error("Error creating user profile:", error);
    throw error;
  }
};

export const ensureUserProfileExists = async (uid: string, email: string, name: string = ""): Promise<UserProfile> => {
  try {
    let profile = await getUserProfile(uid);
    if (!profile) {
      const firstUser = await isFirstUser();
      profile = {
        uid,
        name: name || email.split('@')[0],
        email,
        phone: "",
        role: firstUser ? ROLES.SUPER_ADMIN : ROLES.REQUESTER,
        active: true,
        forcePasswordChange: false,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      await createUserProfile(profile);
    }
    return profile;
  } catch (error) {
    console.error("Error ensuring user profile exists:", error);
    throw error;
  }
};

export const updateUserProfile = async (uid: string, data: Partial<UserProfile>): Promise<void> => {
  try {
    const docRef = doc(db, COLLECTION_NAME, uid);
    await updateDoc(docRef, {
      ...data,
      updatedAt: Date.now(),
    });
  } catch (error) {
    console.error("Error updating user profile:", error);
    throw error;
  }
};
