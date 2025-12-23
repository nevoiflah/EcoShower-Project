import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { CognitoUserPool, CognitoUser, AuthenticationDetails } from 'amazon-cognito-identity-js'
import config from '../config'

const userPool = new CognitoUserPool({
  UserPoolId: config.COGNITO_USER_POOL_ID,
  ClientId: config.COGNITO_CLIENT_ID,
})

const AuthContext = createContext(null)

const INACTIVITY_TIMEOUT = 15 * 60 * 1000 // 15 minutes

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [lastActivity, setLastActivity] = useState(Date.now())

  // Check for existing session on mount
  useEffect(() => {
    checkAuth()
  }, [])

  // Auto-logout after inactivity
  useEffect(() => {
    if (!user) return

    const checkInactivity = () => {
      if (Date.now() - lastActivity > INACTIVITY_TIMEOUT) {
        logout()
        alert('התנתקת אוטומטית עקב חוסר פעילות')
      }
    }

    const interval = setInterval(checkInactivity, 60000) // Check every minute
    return () => clearInterval(interval)
  }, [user, lastActivity])

  // Track user activity
  useEffect(() => {
    if (!user) return

    const updateActivity = () => setLastActivity(Date.now())

    const events = ['mousedown', 'keydown', 'scroll', 'touchstart', 'click']
    events.forEach(event => window.addEventListener(event, updateActivity))

    return () => {
      events.forEach(event => window.removeEventListener(event, updateActivity))
    }
  }, [user])

  const checkAuth = () => {
    const cognitoUser = userPool.getCurrentUser()

    if (cognitoUser) {
      cognitoUser.getSession((err, session) => {
        if (err) {
          setUser(null)
          setLoading(false)
          return
        }

        if (session.isValid()) {
          cognitoUser.getUserAttributes((err, attributes) => {
            if (err) {
              setUser(null)
            } else {
              const userData = {}
              attributes.forEach(attr => {
                userData[attr.Name] = attr.Value
              })
              const groups = session.getIdToken().payload['cognito:groups'] || []
              const isAdminGroup = groups.includes('admins')

              setUser({
                username: cognitoUser.getUsername(),
                email: userData.email,
                name: userData.name,
                role: isAdminGroup ? 'admin' : (userData['custom:role'] || 'user'),
                token: session.getIdToken().getJwtToken(),
              })
            }
            setLoading(false)
          })
        } else {
          setUser(null)
          setLoading(false)
        }
      })
    } else {
      setUser(null)
      setLoading(false)
    }
  }

  const login = (email, password) => {
    return new Promise((resolve, reject) => {
      const cognitoUser = new CognitoUser({
        Username: email,
        Pool: userPool,
      })

      const authDetails = new AuthenticationDetails({
        Username: email,
        Password: password,
      })

      cognitoUser.authenticateUser(authDetails, {
        onSuccess: (session) => {
          cognitoUser.getUserAttributes((err, attributes) => {
            if (err) {
              reject(err)
              return
            }

            const userData = {}
            attributes.forEach(attr => {
              userData[attr.Name] = attr.Value
            })

            const groups = session.getIdToken().payload['cognito:groups'] || []
            const isAdminGroup = groups.includes('admins')

            const loggedInUser = {
              username: cognitoUser.getUsername(),
              email: userData.email,
              name: userData.name,
              role: isAdminGroup ? 'admin' : (userData['custom:role'] || 'user'),
              token: session.getIdToken().getJwtToken(),
            }

            setUser(loggedInUser)
            setLastActivity(Date.now())
            setError(null)
            resolve(loggedInUser)
          })
        },
        onFailure: (err) => {
          setError(err.message)
          reject(err)
        },
        newPasswordRequired: (userAttributes) => {
          reject({ code: 'NewPasswordRequired', userAttributes })
        },
      })
    })
  }

  const register = (email, password, name) => {
    return new Promise((resolve, reject) => {
      const attributeList = [
        { Name: 'email', Value: email },
        { Name: 'name', Value: name },
      ]

      userPool.signUp(email, password, attributeList, null, (err, result) => {
        if (err) {
          setError(err.message)
          reject(err)
          return
        }
        resolve(result)
      })
    })
  }

  const confirmRegistration = (email, code) => {
    return new Promise((resolve, reject) => {
      const cognitoUser = new CognitoUser({
        Username: email,
        Pool: userPool,
      })

      cognitoUser.confirmRegistration(code, true, (err, result) => {
        if (err) {
          reject(err)
          return
        }
        resolve(result)
      })
    })
  }

  const logout = () => {
    const cognitoUser = userPool.getCurrentUser()
    if (cognitoUser) {
      cognitoUser.signOut()
    }
    setUser(null)
  }

  const forgotPassword = (email) => {
    return new Promise((resolve, reject) => {
      const cognitoUser = new CognitoUser({
        Username: email,
        Pool: userPool,
      })

      cognitoUser.forgotPassword({
        onSuccess: (data) => resolve(data),
        onFailure: (err) => reject(err),
      })
    })
  }

  const resetPassword = (email, code, newPassword) => {
    return new Promise((resolve, reject) => {
      const cognitoUser = new CognitoUser({
        Username: email,
        Pool: userPool,
      })

      cognitoUser.confirmPassword(code, newPassword, {
        onSuccess: () => resolve(),
        onFailure: (err) => reject(err),
      })
    })
  }

  const getToken = () => {
    return user?.token || null
  }

  const updateUserProfile = (name) => {
    return new Promise((resolve, reject) => {
      const cognitoUser = userPool.getCurrentUser()

      if (!cognitoUser) {
        reject(new Error('No user logged in'))
        return
      }

      cognitoUser.getSession((err, session) => {
        if (err) {
          reject(err)
          return
        }

        const attributes = [
          { Name: 'name', Value: name }
        ]

        cognitoUser.updateAttributes(attributes, (err, result) => {
          if (err) {
            reject(err)
            return
          }
          setUser(prev => ({ ...prev, name }))
          resolve(result)
        })
      })
    })
  }

  const isAdmin = user?.role === 'admin'

  const value = {
    user,
    loading,
    error,
    isAdmin,
    login,
    logout,
    register,
    confirmRegistration,
    forgotPassword,
    resetPassword,
    getToken,
    checkAuth,
    updateUserProfile,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}

export default AuthContext