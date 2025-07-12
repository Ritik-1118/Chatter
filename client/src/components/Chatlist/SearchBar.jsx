import { useStateProvider } from "@/context/StateContext";
import { reducerCases } from "@/context/constants";
import React from "react";
import { BiSearchAlt2 } from "react-icons/bi";
import { BsFilter } from "react-icons/bs";
import { useTheme } from '@/context/ThemeContext';

function SearchBar () {
  const [ { contactSearch }, dispatch ] = useStateProvider();
  const { theme } = useTheme();
  return (
    <div className={ `flex py-3 pl-5 items-center gap-3 h-14 ${theme === 'dark' ? 'bg-dark-surface' : 'bg-light-surface'}` }>
      <div className={ `flex items-center gap-5 px-3 mr-5 py-1 rounded-lg flex-grow border ${theme === 'dark' ? 'bg-dark-secondary-background border-dark-divider' : 'bg-light-secondary-background border-light-divider'}` }>
        <div>
          <BiSearchAlt2 className={ `cursor-pointer text-l ${theme === 'dark' ? 'text-dark-secondary-text' : 'text-light-secondary-text'}` } />
        </div>
        <div>
          <input
            type="text"
            placeholder="Search to start a new chat!"
            className={ `bg-transparent text-sm focus:outline-none w-full ${theme === 'dark' ? 'text-dark-primary-text' : 'text-light-primary-text'}` }
            value={ contactSearch }
            onChange={ e =>
              dispatch( {
                type: reducerCases.SET_CONTACT_SEARCH,
                contactSearch: e.target.value
              }
              ) }
          />
        </div>
      </div>
      {/* <div className=" pr-5 pl-3">
        <BsFilter className={ `cursor-pointer text-l ${theme === 'dark' ? 'text-dark-secondary-text' : 'text-light-secondary-text'}` } />
      </div> */}
    </div>
  )
}

export default SearchBar;
