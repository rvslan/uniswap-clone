import { useState, useEffect, createContext } from 'react'
import contract from '../../smart_contract/artifacts/contracts/Transactions.sol/Transactions.json'
import { ethers } from 'ethers'
import { client } from '../lib/sanity'
import { useRouter } from 'next/router'

export const TransactionContext = createContext()

let eth

if (typeof window !== 'undefined') {
  eth = window.ethereum
}

const getEthereumContract = () => {
  const provider = new ethers.providers.Web3Provider(ethereum)
  const signer = provider.getSigner()
  const transactionContract = new ethers.Contract(
    process.env.NEXT_PUBLIC_SMART_CONTRACT_ADDRESS,
    contract.abi,
    signer
  )

  return transactionContract
}

export const TransactionProvider = ({ children }) => {
  const [currentAccount, setCurrentAccount] = useState()
  const [isLoading, setIsLoading] = useState(false)
  const [formData, setFormData] = useState({
    addressTo: '',
    amount: '',
  })

  const router = useRouter()

  useEffect(() => {
    checkIfWalletIsConnected()
    console.log('Wallet is connected')
  }, [])

  /**
   * Create user profile in Sanity
   */
  useEffect(() => {
    if (!currentAccount) return
    ;(async () => {
      await client.createIfNotExists({
        _type: 'users',
        _id: currentAccount,
        userName: 'Unnamed',
        address: currentAccount,
      })
    })()
  }, [currentAccount])

  /**
   * Prompts user to connect their MetaMask wallet
   * @param {*} metamask Injected MetaMask code from the browser
   */
  const connectWallet = async (metamask = eth) => {
    try {
      if (!metamask) return alert('Metamask is not installed')

      const accounts = await metamask.request({ method: 'eth_requestAccounts' })

      setCurrentAccount(accounts[0])
    } catch (error) {
      console.error(error)
      throw new Error('No ethereum object.')
    }
  }

  /**
   * Checks if MetaMask is installed and an account is connected
   * @param {*} metamask Injected MetaMask code from the browser
   * @returns
   */
  const checkIfWalletIsConnected = async (metamask = eth) => {
    try {
      if (!metamask) return alert('Metamask is not installed')

      const accounts = await metamask.request({ method: 'eth_accounts' })

      if (accounts.length) {
        setCurrentAccount(accounts[0])
      }
    } catch (error) {
      console.error(error)
      throw new Error('No ethereum object.')
    }
  }

  /**
   * Executes a transaction
   * @param {*} metamask Injected MetaMask code from the browser
   * @param {string} currentAccount Current user's address
   */
  const sendTransaction = async (
    metamask = eth,
    connectedAccount = currentAccount
  ) => {
    try {
      if (!metamask) return alert('Metamask is not installed')

      const { addressTo, amount } = formData
      const transactionContract = getEthereumContract()

      console.log(amount)

      const parsedAmount = ethers.utils.parseEther(amount)

      await metamask.request({
        method: 'eth_sendTransaction',
        params: [
          {
            from: connectedAccount,
            to: addressTo,
            gas: '0x7EF40', // 520000 Gwei
            value: parsedAmount._hex,
          },
        ],
      })

      const transactionHash = await transactionContract.publishTransaction(
        addressTo,
        parsedAmount,
        `Transferring ETH ${parsedAmount} to ${addressTo}`,
        'TRANSFER'
      )

      setIsLoading(true)

      await transactionHash.wait()

      // DB
      await saveTransaction(
        transactionHash.hash,
        amount,
        connectedAccount,
        addressTo
      )

      setIsLoading(false)
    } catch (error) {
      console.log(error)
    }
  }

  const handleChange = (e, name) => {
    setFormData((prevState) => ({ ...prevState, [name]: e.target.value }))
  }

  /**
   * Saves transaction to Sanity DB
   * @param {string} txHash Transaction hash
   * @param {number} amount Amount of ETH that was sent
   * @param {string} fromAddress Sender address
   * @param {string} toAddress Recipient address
   * @returns null
   */
  const saveTransaction = async (
    txHash,
    amount,
    fromAddress = currentAccount,
    toAddress
  ) => {
    const transactionDoc = {
      _type: 'transactions',
      _id: txHash,
      fromAddress: fromAddress,
      toAddress: toAddress,
      timestamp: new Date().toISOString(),
      txHash: txHash,
      amount: parseFloat(amount),
    }

    await client.createIfNotExists(transactionDoc)

    await client
      .patch(currentAccount)
      .setIfMissing({ transactions: [] })
      .insert('after', 'transactions[-1]', [
        {
          _key: txHash,
          _ref: txHash,
          _type: 'reference',
        },
      ])
      .commit()

    return
  }

  /**
   * Trigger loading modal
   */
  useEffect(() => {
    if (isLoading) {
      router.push(`/?loading=${currentAccount}`)
    } else {
      router.push(`/`)
    }
  }, [isLoading])

  return (
    <TransactionContext.Provider
      value={{
        currentAccount,
        connectWallet,
        sendTransaction,
        handleChange,
        formData,
        isLoading,
      }}
    >
      {children}
    </TransactionContext.Provider>
  )
}
