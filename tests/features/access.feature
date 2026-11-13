@access
Feature: Access and error pages
  As a tester of a site
  I want to assert who may open which page, and the "Access denied" and "Page not found" pages
  So that the permissions of the roles are covered

  # admin has the "Administrator" role, editor the stock "Editor" role and
  # member no role beyond "Authenticated".

  @critical
  Scenario: A visitor is denied the administration
    Given I am an anonymous user
    When I go to "/admin/content"
    Then the page should be an access denied page
    And the page heading should be "Access denied"
    And the page should not be a page not found page
    And I should not have access to "admin/content"
    And I should not have access to "node/add/post"

  Scenario: A path that does not exist answers page not found
    Given I am an anonymous user
    When I go to "/no-such-page-here"
    Then the page should be a page not found page
    And the page should not be an access denied page
    And the response status code should be 404

  Scenario: A content page is neither error page
    Given I am on "/visit-the-apiary"
    Then the page should not be an access denied page
    And the page should not be a page not found page
    And I should have access to "visit-the-apiary"

  @critical
  Scenario: The editor manages content but not the structure of the site
    Given I am logged in as "editor"
    Then I should have access to "admin/content"
    And I should have access to "node/add/post"
    And I should have access to "admin/structure/taxonomy"
    And I should have access to "admin/content/files"
    But I should not have access to "admin/structure/layouts"
    And I should not have access to "admin/structure/menu"
    And I should not have access to "admin/people"
    And I should not have access to "admin/config/people/permissions"
    And I should not have access to "admin/reports/status"
    And I should not have access to "admin/config/development/configuration"

  Scenario: The editor is shown the access denied page for the layouts
    Given I am logged in as "editor"
    When I go to "/admin/structure/layouts"
    Then the page should be an access denied page
    And the response status code should be 403

  Scenario: A signed-in user without a role sees no administration
    Given I am logged in as "member"
    Then I should not have access to "admin/content"
    And I should not have access to "admin/dashboard"
    And I should not have access to "node/add"
    And I should have access to "user"
    And I should not see the administration bar

  Scenario: Unpublished content is hidden from visitors and shown to editors
    Given I am an anonymous user
    Then I should not have access to "posts/unpublished-field-note"
    Given I am logged in as "editor"
    Then I should have access to "posts/unpublished-field-note"

  Scenario: The administrator may open every administration page
    Given I am logged in as "admin"
    Then I should have access to "admin/structure/layouts"
    And I should have access to "admin/people"
    And I should have access to "admin/config/people/permissions"
    And I should have access to "admin/reports/status"
