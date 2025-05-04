interface Project {
  id: number;
  title: string;
  description: string;
  skills: string[];
  github?: string;
  link?: string;
}

export const projectsData: Project[] = [
  {
    id: 1,
    title: 'Community Sponsored Project',
    description:
      'Being a member contributing to the front end and back end in the team Bits N’ Bytes, we developed a website for Niagara Squash including Authentication and Authorization systems, business logic, and user-friendly interfaces. I also was the bridge between my team and the client during the meetings.',
    skills: ['C#', 'SQL', 'JQuery', 'SCSS', 'Bootstrap'],
  },
  {
    id: 2,
    title: 'Expensify',
    description:
      'Expenses app. Created in react with Redux management state. It contains google authentication system and it complies with UX standards.',
    skills: ['React', 'Firebase', 'Redux', 'SCSS'],
    github: 'https://github.com/Crisest/expensify',
    link: 'https://warm-basin-98453.herokuapp.com/',
  },
  {
    id: 3,
    title: 'Financial WebApp',
    description:
      'Web application created for Stackpole International independently. This web-app was made for the finance department with the goal of optimizing the approval time that budget request takes. It also had the purpose to eliminate paper requests through the department. Another feature was to facilitate the process of asset transfers within the company.',
    skills: ['PHP', 'MySQL', 'JQuery', 'Bootstrap'],
  },
  {
    id: 4,
    title: 'Task Application REST API',
    description:
      'Fully functional REST API made with Node.js and Express. It uses JSON web tokens to Authenticate the Users and MongoDB / Mongo Atlas to store the data. It was completely tested and deployed.',
    skills: ['Nodejs', 'MongoDB', 'Express'],
    github: 'https://github.com/Crisest/task-app',
    link: 'https://task-manager-yorguin.herokuapp.com/',
  },
  {
    id: 5,
    title: 'Weather App - Web server',
    description:
      'Simple App that fetches data from third party APIs. The API fetches data from darkskynet and uses Geocoders to parse the location given.',
    skills: ['Nodejs', 'Bootstrap'],
    link: 'https://crisest-weather-app.herokuapp.com/',
    github: 'https://github.com/Crisest/web-server-node',
  },
  {
    id: 6,
    title: 'Indecision App',
    description: 'Task app that will decide for you the next task.',
    skills: ['React', 'SCSS', 'Express'],
    link: 'https://indapp-crisest.herokuapp.com/',
    github: 'https://github.com/Crisest/Todo-React',
  },
];
